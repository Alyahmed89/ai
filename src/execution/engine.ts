import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getSupabase } from '../supabase';
import { callLlm } from './llm';

const ExpectedResponseSchema = z.object({
  next: z.string().nullable().optional(),
  actions: z.array(z.object({
    type: z.literal('api'),
    endpoint: z.string(),
    method: z.string().optional(),
    payload: z.any().optional(),
    headers: z.record(z.string()).optional(),
  })).optional(),
  pro_check: z.object({
    rules: z.array(z.string()).optional(),
    plans: z.array(z.string()).optional(),
  }).optional(),
}).strict();

export async function runFlow(flowRunId: string): Promise<void> {
  console.log(`[engine] runFlow start flowRunId=${flowRunId}`);
  try {
    await updateFlowRun(flowRunId, { status: 'running' });

    const flowRun = await getFlowRun(flowRunId);
    if (!flowRun?.flow_id) throw new Error(`Flow run ${flowRunId} has no flow_id`);
    console.log(`[engine] flow_id=${flowRun.flow_id}`);

    const firstStep = await getFirstStep(flowRun.flow_id);
    if (!firstStep) throw new Error(`No steps found for flow ${flowRun.flow_id}`);
    console.log(`[engine] firstStep id=${firstStep.id} ref=${firstStep.ref}`);

    const visited = new Set<string>();
    const maxSteps = 50;
    let stepCount = 0;
    let currentStep = firstStep;

    while (currentStep) {
      if (stepCount >= maxSteps) throw new Error('Max steps exceeded');
      if (visited.has(currentStep.id)) throw new Error('Cycle detected');
      visited.add(currentStep.id);
      stepCount++;

      console.log(`[engine] executing step stepCount=${stepCount} stepId=${currentStep.id} ref=${currentStep.ref}`);
      const nextRef = await runStep(currentStep, flowRunId, flowRun);
      console.log(`[engine] step done ref=${currentStep.ref} nextRef=${nextRef}`);
      if (!nextRef) break;

      const nextStep = await getStepByFlowAndRef(flowRun.flow_id, nextRef);
      if (!nextStep) throw new Error(`Step ref "${nextRef}" not found in flow ${flowRun.flow_id}`);
      currentStep = nextStep;
    }

    await updateFlowRun(flowRunId, { status: 'completed' });
    console.log(`[engine] runFlow completed flowRunId=${flowRunId}`);
  } catch (err) {
    console.error(`[engine] runFlow error flowRunId=${flowRunId}:`, err);
    try {
      await updateFlowRun(flowRunId, { status: 'failed', error: err instanceof Error ? err.message : String(err) });
    } catch (updateErr) {
      console.error(`[engine] failed to update flow run status:`, updateErr);
    }
    throw err;
  }
}

async function runStep(step: any, flowRunId: string, flowRun: any): Promise<string | null> {
  console.log(`[engine] runStep start stepRef=${step.ref} flowRunId=${flowRunId}`);
  const stepRunId = await createStepRun(flowRunId, step.id);
  console.log(`[engine] runStep stepRunId=${stepRunId}`);

  // Build variable context
  const context = await buildContext(flowRunId, stepRunId, flowRun);

  // Step 1 — Resolve variables in instructions
  const renderedInstructions = step.instructions ? resolveVariables(step.instructions, context) : null;
  console.log(`[engine] rendered_instructions:`, renderedInstructions);

  // Step 2 — Call LLM
  const schemaJson = JSON.stringify(step.expected_response, null, 2);
  const userPrompt = `${renderedInstructions || ''}\n\nReturn ONLY valid JSON matching this schema:\n${schemaJson}`;

  let aiResponse: any;
  try {
    aiResponse = await callLlm(step.system_message || null, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[engine] LLM call failed:`, msg);
    await updateStepRun(stepRunId, {
      status: 'failed',
      error: msg,
      trace: { llm_error: msg, step: 'llm' },
    });
    throw new Error(`Step ${step.ref} LLM failed: ${msg}`);
  }

  // Step 3 — Zod validate ai_response against expected_response schema
  const zodResult = ExpectedResponseSchema.safeParse(aiResponse);
  console.log(`[engine] zod validation:`, JSON.stringify(zodResult, null, 2));

  if (!zodResult.success) {
    const zodError = zodResult.error.flatten();
    console.error(`[engine] zod validation FAILED:`, JSON.stringify(zodError, null, 2));
    await updateStepRun(stepRunId, {
      status: 'failed',
      error: `AI response failed schema: ${JSON.stringify(zodError)}`,
      trace: { ai_response: aiResponse, zod_result: zodError, step: 'zod_validation' },
    });
    throw new Error(`Step ${step.ref} AI response failed schema validation`);
  }

  const validated = zodResult.data;
  const next = validated.next ?? null;
  const actions = Array.isArray(validated.actions) ? validated.actions : [];

  // Step 4 — Extract rules and plans from step/flow context
  const rules: string[] = [];
  const plans: string[] = [];
  if (validated.pro_check?.rules) rules.push(...validated.pro_check.rules);
  if (validated.pro_check?.plans) plans.push(...validated.pro_check.plans);
  // Also load from step metadata if present
  if (step.rules && Array.isArray(step.rules)) rules.push(...step.rules);
  if (step.plans && Array.isArray(step.plans)) plans.push(...step.plans);

  // Step 5 — CALL PROLOG pro_check
  const prologUrl = process.env.PROLOG_URL || 'http://localhost:4000';
  console.log(`[engine] calling prolog at ${prologUrl}/api/v1/pro_check`);
  console.log(`[engine] pro_check payload:`, JSON.stringify({ response: validated, rules, plans }, null, 2));

  let proCheckResult: { status: string; plans?: Array<{ id: string; status: string }> } = { status: 'pass' };
  try {
    const prologRes = await fetch(`${prologUrl}/api/v1/pro_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: validated, rules, plans }),
    });
    if (prologRes.ok) {
      proCheckResult = await prologRes.json();
    } else {
      console.warn(`[engine] prolog returned ${prologRes.status}, treating as pass`);
    }
  } catch (err) {
    console.warn(`[engine] prolog call failed:`, err);
    // If Prolog is unreachable, continue (fail-open for now)
  }
  console.log(`[engine] pro_check result:`, JSON.stringify(proCheckResult, null, 2));

  // Step 6 — Handle Prolog response
  if (proCheckResult.status === 'stop') {
    console.error(`[engine] prolog STOP for step=${step.ref}`);
    await updateStepRun(stepRunId, {
      status: 'failed',
      error: 'Prolog returned stop',
      trace: { zod_result: 'valid', pro_check_result: proCheckResult, plan_statuses: proCheckResult.plans, step: 'prolog_stop' },
    });
    throw new Error(`Prolog stopped execution at step ${step.ref}`);
  }

  // Step 7 — Execute actions (ONLY after Prolog pass)
  for (const action of actions) {
    if (action.type !== 'api') continue;

    // Resolve variables just before each action so subsequent actions
    // can use variables set by previous actions in the same step
    let url = normalizeValue(resolveVariables(action.endpoint, context));
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...normalizeValue(resolveVariables(action.headers || {}, context)),
    };

    const { data: endpoint } = await getSupabase()
      .from('endpoint_registry')
      .select('*')
      .eq('name', action.endpoint)
      .maybeSingle();

    if (endpoint) {
      url = endpoint.url;
      headers = { ...(endpoint.headers || {}), ...headers };
    }

    const payload = action.payload ? normalizeValue(resolveVariables(action.payload, context)) : undefined;

    console.log(`[engine] executing action: ${action.method || 'GET'} ${url}`);
    const res = await fetch(url, {
      method: (action.method || 'GET').toUpperCase(),
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    let responseBody: string | null = null;
    try {
      responseBody = await res.text();
    } catch {
      // ignore read errors
    }

    // Persist to api_calls table
    const httpMethod = (action.method || 'GET').toUpperCase();
    await getSupabase().from('api_calls').insert({
      id: randomUUID(),
      flow_run_id: flowRunId,
      step_run_id: stepRunId,
      endpoint_name: url,
      http_method: httpMethod,
      request_url: url,
      request_headers: headers,
      request_body: payload,
      response_status: res.status,
      response_body: responseBody,
      success: res.ok,
      error: res.ok ? null : `HTTP ${res.status}`,
      created_at: new Date().toISOString(),
    }).maybeSingle();

    // Auto-store response as variable for subsequent steps
    if (res.ok && responseBody) {
      try {
        const parsed = JSON.parse(responseBody);
        const varName = `api_response_${action.endpoint}`;
        await getSupabase().from('variables').insert({
          id: randomUUID(),
          flow_run_id: flowRunId,
          step_run_id: stepRunId,
          key: varName,
          value: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          scope: 'step_run',
          created_at: new Date().toISOString(),
        }).maybeSingle();
        // Also add to running context so subsequent actions in same step can use it
        context[varName] = parsed;
      } catch {
        // response is not JSON, skip auto-store
      }
    }

    if (!res.ok) {
      throw new Error(`API call failed: ${url} ${res.status}`);
    }
    console.log(`[engine] action completed: ${url} ${res.status}`);
  }

  // Step 8 — Persist everything
  const planStatuses = proCheckResult.plans || [];
  const trace = {
    zod_result: 'valid',
    pro_check_result: proCheckResult,
    plan_statuses: planStatuses,
  };

  await updateStepRun(stepRunId, {
    ai_response: normalizeValue(validated),
    ai_response_valid: true,
    rendered_instructions: renderedInstructions,
    resolved_variables: context,
    trace,
    status: 'completed',
  });

  // Write refs entries for rules and plans
  for (const ruleId of rules) {
    await getSupabase().from('refs').insert({
      id: randomUUID(),
      flow_run_id: flowRunId,
      step_run_id: stepRunId,
      rule_id: ruleId,
      key: 'rule',
      value: ruleId,
      source: 'pro_check',
      created_at: new Date().toISOString(),
    }).maybeSingle();
  }
  for (const plan of planStatuses) {
    await getSupabase().from('refs').insert({
      id: randomUUID(),
      flow_run_id: flowRunId,
      step_run_id: stepRunId,
      rule_id: plan.id,
      key: 'plan',
      value: plan.status,
      source: 'pro_check',
      created_at: new Date().toISOString(),
    }).maybeSingle();
  }

  // Step 9 — Conditions override
  const conditionNextRef = await evaluateConditions(step.id, validated);
  if (conditionNextRef) {
    console.log(`[engine] step=${step.ref} next=${conditionNextRef} (condition)`);
    return conditionNextRef;
  }

  // Step 10 — Direct transition
  if (next) {
    console.log(`[engine] step=${step.ref} next=${next}`);
    return next;
  }

  // Terminal step — end flow gracefully
  console.log(`[engine] step=${step.ref} is terminal, completing flow`);
  await updateFlowRun(flowRunId, { status: 'completed' });
  return null;
}

async function getFlowRun(flowRunId: string): Promise<any> {
  const { data, error } = await getSupabase()
    .from('flow_runs')
    .select('*')
    .eq('id', flowRunId)
    .single();
  if (error) throw new Error(`Failed to get flow run: ${error.message}`);
  return data;
}

async function getFirstStep(flowId: string): Promise<any> {
  const { data, error } = await getSupabase()
    .from('steps')
    .select('*')
    .eq('flow_id', flowId)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to get first step: ${error.message}`);
  return data;
}

async function getStepByFlowAndRef(flowId: string, ref: string): Promise<any> {
  const { data, error } = await getSupabase()
    .from('steps')
    .select('*')
    .eq('flow_id', flowId)
    .eq('ref', ref)
    .single();
  if (error) throw new Error(`Step ref "${ref}" not found in flow ${flowId}`);
  return data;
}

async function getStepById(stepId: string): Promise<any> {
  const { data, error } = await getSupabase()
    .from('steps')
    .select('*')
    .eq('id', stepId)
    .single();
  if (error) throw new Error(`Step not found by id ${stepId}: ${error.message}`);
  return data;
}

async function createStepRun(flowRunId: string, stepId: string): Promise<string> {
  const id = randomUUID();
  const { data, error } = await getSupabase()
    .from('step_runs')
    .insert({
      id,
      flow_run_id: flowRunId,
      step_id: stepId,
      status: 'running',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create step run: ${error.message}`);
  return data.id;
}

async function updateStepRun(stepRunId: string, data: any): Promise<void> {
  const { error } = await getSupabase()
    .from('step_runs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', stepRunId);
  if (error) throw new Error(`Failed to update step run: ${error.message}`);
}

export async function createFlowRun(flowId: string): Promise<string> {
  const id = randomUUID();
  const { error } = await getSupabase()
    .from('flow_runs')
    .insert({
      id,
      flow_id: flowId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`Failed to create flow run: ${error.message}`);
  return id;
}

async function updateFlowRun(flowRunId: string, data: any): Promise<void> {
  const { error } = await getSupabase()
    .from('flow_runs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', flowRunId);
  if (error) throw new Error(`Failed to update flow run: ${error.message}`);
}

async function evaluateConditions(stepId: string, expected: any): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('step_conditions')
    .select('*')
    .eq('step_id', stepId);

  if (error) throw new Error(`Failed to get conditions: ${error.message}`);
  if (!data || data.length === 0) return null;

  for (const c of data) {
    if (!(c.key in expected)) continue;

    if (expected[c.key] === c.value) {
      if (!c.next_step_id) {
        throw new Error(`Condition matched but no next_step_id for step ${stepId}`);
      }

      const step = await getStepById(c.next_step_id);
      if (!step?.ref) {
        throw new Error(`Step ${c.next_step_id} has no ref`);
      }

      return step.ref;
    }
  }

  return null;
}

// ── Variable Resolution ──────────────────────────────────────────────

async function buildContext(flowRunId: string, stepRunId: string, flowRun: any): Promise<Record<string, any>> {
  const context: Record<string, any> = {};

  // flow_run level
  if (flowRun?.input_variables) {
    Object.assign(context, flowRun.input_variables);
  }

  // variables table — scope priority: step_run > flow_run > global
  const { data: vars } = await getSupabase()
    .from('variables')
    .select('*')
    .or(`flow_run_id.eq.${flowRunId},scope.eq.global`);

  if (vars) {
    // step_run scoped first
    for (const v of vars) {
      if (v.step_run_id === stepRunId) {
        context[v.key] = v.value;
      }
    }
    // then flow_run scoped (won't overwrite step_run)
    for (const v of vars) {
      if (v.scope === 'flow_run' && v.flow_run_id === flowRunId && !(v.key in context)) {
        context[v.key] = v.value;
      }
    }
    // then global (won't overwrite anything already set)
    for (const v of vars) {
      if (v.scope === 'global' && !(v.key in context)) {
        context[v.key] = v.value;
      }
    }
  }

  return context;
}

function resolveVariables(input: any, context: Record<string, any>): any {
  if (typeof input === 'string') {
    return input.replace(/\[\[var:([^\]]+)\]\]/g, (_match, key) => {
      const trimmed = key.trim();
      return trimmed in context ? String(context[trimmed]) : _match;
    });
  }

  if (Array.isArray(input)) {
    return input.map(item => resolveVariables(item, context));
  }

  if (input && typeof input === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      result[k] = resolveVariables(v, context);
    }
    return result;
  }

  return input;
}

function normalizeValue(value: any): any {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue).filter(v => v !== undefined);
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      result[k] = normalizeValue(v);
    }
    return result;
  }

  return value;
}
