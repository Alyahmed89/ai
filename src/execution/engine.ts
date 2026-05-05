import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getSupabase } from '../supabase';
import { callLlm } from './llm';

const STEP_TIMEOUT_MS = 60000;

/**
 * Call pro_check on the given output, store request/response in step run result,
 * and if "stop", pause the step and flow run (do NOT fail, do NOT auto-start correction).
 * Returns 'continue' or 'paused'.
 */
async function callProCheckOnOutput(
  stepRun: any,
  output: any,
  rules: string[],
  plans: string[],
): Promise<'continue' | 'paused'> {
  const prologUrl = process.env.PROLOG_URL || 'https://prolog.anyapp.cfd';

  const proCheckRequest = {
    response: output,
    rules,
    plans,
    step_run_id: stepRun.id,
  };

  // ----- STORE REQUEST IMMEDIATELY -----
  const baseResult = stepRun.result && typeof stepRun.result === 'object' ? stepRun.result : {};
  const resultWithRequest = {
    ...baseResult,
    pro_check_request: proCheckRequest,
  };
  await updateStepRun(stepRun.id, { result: resultWithRequest });
  stepRun.result = resultWithRequest; // keep in-memory copy consistent

  // ----- CALL PROLOG -----
  let proCheckResponse: any = { status: 'pass' };
  let prologReachable = true;
  try {
    const prologRes = await fetch(`${prologUrl}/api/v1/pro_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proCheckRequest),
    });
    if (prologRes.ok) {
      proCheckResponse = await prologRes.json();
    } else {
      prologReachable = false;
    }
  } catch (err: any) {
    console.warn('[engine] pro_check call failed:', err);
    prologReachable = false;
    // Store error in step run result
    const resultWithError = {
      ...stepRun.result,
      pro_check_error: { message: err.message, stack: err.stack },
    };
    await updateStepRun(stepRun.id, { result: resultWithError });
    stepRun.result = resultWithError;
  }

  // ----- STORE RESPONSE IMMEDIATELY -----
  const resultWithResponse = {
    ...stepRun.result,
    pro_check: proCheckResponse,
  };
  await updateStepRun(stepRun.id, { result: resultWithResponse });
  stepRun.result = resultWithResponse;

  // ----- HANDLE STOP -----
  if (proCheckResponse.status === 'stop') {
    // Pause the step and the flow run – DO NOT FAIL
    await updateStepRun(stepRun.id, { status: 'paused' });
    await updateFlowRun(stepRun.flow_run_id, {
      status: 'paused',
      paused_at_step_id: stepRun.id,
    });
    return 'paused';
  }

  if (!prologReachable) {
    // Prolog unreachable — fail-safe pause
    await updateStepRun(stepRun.id, { status: 'paused' });
    await updateFlowRun(stepRun.flow_run_id, {
      status: 'paused',
      paused_at_step_id: stepRun.id,
    });
    return 'paused';
  }

  return 'continue';
}

async function handleApiFailure(
  responseBody: string,
  statusCode: number,
  url: string,
  context: Record<string, any>,
  stepRunId: string,
  flowRunId: string,
  step: any,
): Promise<'continue' | 'paused'> {
  const errorMsg = `API ${statusCode}: ${(responseBody || '').slice(0, 500)}`;
  const apiError = { api_error: { statusCode, body: responseBody, url } };

  // Store API error details in the step run so the UI displays them
  // Merge with any existing result (e.g. from a previous partial write)
  const { data: existingStepRun } = await getSupabase()
    .from('step_runs')
    .select('*')
    .eq('id', stepRunId)
    .maybeSingle();
  if (!existingStepRun) return 'continue';
  const existingResult = existingStepRun.result && typeof existingStepRun.result === 'object' ? existingStepRun.result : {};
  await updateStepRun(stepRunId, {
    error: errorMsg,
    result: { ...existingResult, ...apiError },
  });
  existingStepRun.result = { ...existingResult, ...apiError };

  // Collect rules and plans from step metadata
  const rules: string[] = [];
  const plans: string[] = [];
  if (step.rules && Array.isArray(step.rules)) rules.push(...step.rules);
  if (step.plans && Array.isArray(step.plans)) plans.push(...step.plans);
  if (context.plan_id) plans.push(context.plan_id);

  // Let pro_check decide if the step should pause or fail
  return callProCheckOnOutput(existingStepRun, apiError, rules, plans);
}

function buildExpectedResponseSchema(stepExpectedResponse: any): z.ZodObject<any> {
  // Build the step-specific schema from expected_response (e.g. { plan_id: string })
  let shape: Record<string, z.ZodTypeAny> = {};
  if (stepExpectedResponse && typeof stepExpectedResponse === 'object') {
    if (stepExpectedResponse.type === 'object' && stepExpectedResponse.properties) {
      for (const [key, prop] of Object.entries<any>(stepExpectedResponse.properties)) {
        switch (prop.type) {
          case 'string': shape[key] = z.string(); break;
          case 'number': shape[key] = z.number(); break;
          case 'boolean': shape[key] = z.boolean(); break;
          case 'integer': shape[key] = z.number().int(); break;
          case 'array': shape[key] = z.array(z.any()); break;
          case 'object': shape[key] = z.record(z.any()); break;
          default: shape[key] = z.any(); break;
        }
      }
      if (stepExpectedResponse.required) {
        const requiredSet = new Set(stepExpectedResponse.required);
        const optionalShape: Record<string, z.ZodTypeAny> = {};
        for (const key of Object.keys(shape)) {
          optionalShape[key] = requiredSet.has(key) ? shape[key] : shape[key].optional();
        }
        shape = optionalShape;
      }
    }
  }

  // Merge with engine-internal fields
  return z.object({
    ...shape,
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
    system_result: z.any().optional(),
  }).passthrough();
}

export async function runFlow(flowRunId: string, userInput?: Record<string, any>): Promise<void> {
  console.log(`[engine] runFlow start flowRunId=${flowRunId}`);
  try {
    const flowRun = await getFlowRun(flowRunId);
    if (!flowRun?.flow_id) throw new Error(`Flow run ${flowRunId} has no flow_id`);

    // If resuming from paused state, apply user_input and find resume step
    let currentStep: any;
    if (flowRun.status === 'paused' && flowRun.paused_at_step_id) {
      console.log(`[engine] resuming from paused step ${flowRun.paused_at_step_id}`);

      // Apply user_input variables before resuming
      if (userInput && typeof userInput === 'object') {
        for (const [key, value] of Object.entries(userInput)) {
          await getSupabase().from('variables').insert({
            id: randomUUID(),
            flow_run_id: flowRunId,
            step_run_id: null,
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            scope: 'flow_run',
            created_at: new Date().toISOString(),
          }).maybeSingle();
        }
      }

      // Find the step after paused_at_step_id by order_index
      const pausedStep = await getStepById(flowRun.paused_at_step_id);
      if (!pausedStep) throw new Error(`Paused step ${flowRun.paused_at_step_id} not found`);

      const nextStep = await getNextStepByOrder(flowRun.flow_id, pausedStep.order_index);
      if (!nextStep) {
        // No next step — this was the last step, so just complete
        await updateFlowRun(flowRunId, { status: 'completed', paused_at_step_id: null });
        console.log(`[engine] no step after paused step, completing flow`);
        return;
      }
      currentStep = nextStep;

      await updateFlowRun(flowRunId, { status: 'running', paused_at_step_id: null });
    } else {
      // Fresh start
      await updateFlowRun(flowRunId, { status: 'running' });

      const firstStep = await getFirstStep(flowRun.flow_id);
      if (!firstStep) throw new Error(`No steps found for flow ${flowRun.flow_id}`);
      console.log(`[engine] firstStep id=${firstStep.id} ref=${firstStep.ref}`);
      currentStep = firstStep;
    }

    const visited = new Set<string>();
    const maxSteps = 50;
    let stepCount = 0;

    while (currentStep) {
      if (stepCount >= maxSteps) throw new Error('Max steps exceeded');
      if (visited.has(currentStep.id)) throw new Error('Cycle detected');
      visited.add(currentStep.id);
      stepCount++;

      console.log(`[engine] executing step stepCount=${stepCount} stepId=${currentStep.id} ref=${currentStep.ref}`);
      const stepResult = await runStep(currentStep, flowRunId, flowRun);
      console.log(`[engine] step done ref=${currentStep.ref} stepResult=${JSON.stringify(stepResult)}`);

      // Handle paused signal from API failure pro_check
      if (stepResult && typeof stepResult === 'object' && 'status' in stepResult && stepResult.status === 'paused') {
        console.log(`[engine] flow paused at step ${currentStep.id} due to API failure`);
        return;
      }

      if (stepResult === '__PAUSED__') {
        // Step paused itself (condition matched with no next edge)
        console.log(`[engine] flow paused at step ${currentStep.id}`);
        return;
      }

      if (!stepResult) break;

      const nextStep = await getStepByFlowAndRef(flowRun.flow_id, stepResult as string);
      if (!nextStep) throw new Error(`Step ref "${stepResult}" not found in flow ${flowRun.flow_id}`);
      currentStep = nextStep;
    }

    await updateFlowRun(flowRunId, { status: 'completed' });
    console.log(`[engine] runFlow completed flowRunId=${flowRunId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[engine] runFlow error flowRunId=${flowRunId}:`, msg);
    try {
      await updateFlowRun(flowRunId, { status: 'failed', error: msg });
    } catch (updateErr) {
      console.error(`[engine] failed to update flow run status:`, updateErr);
    }
    throw err;
  }
}

async function runStep(step: any, flowRunId: string, flowRun: any): Promise<string | null | { status: 'paused'; stepRunId: string }> {
  console.log(`[engine] runStep start stepRef=${step.ref} flowRunId=${flowRunId}`);
  const stepRunId = await createStepRun(flowRunId, step.id);
  console.log(`[engine] runStep stepRunId=${stepRunId}`);

  // Build variable context
  const context = await buildContext(flowRunId, stepRunId, flowRun);

  // Step 1 — Resolve variables in instructions
  const renderedInstructions = step.instructions ? resolveVariables(step.instructions, context) : null;
  console.log(`[engine] rendered_instructions:`, renderedInstructions);

  // Step 2 — Build LLM prompt with endpoint samples
  const schemaJson = JSON.stringify(step.expected_response, null, 2);

  // Collect endpoint samples referenced in expected_response actions
  let endpointSamples = '';
  if (step.expected_response?.actions) {
    const endpointNames = step.expected_response.actions
      .filter((a: any) => a.type === 'api' && a.endpoint)
      .map((a: any) => a.endpoint);
    if (endpointNames.length > 0) {
      const { data: endpoints } = await getSupabase()
        .from('endpoint_registry')
        .select('name, url, method, headers, sample_request, sample_response')
        .in('name', endpointNames);
      if (endpoints) {
        endpointSamples = '\n\nAvailable endpoint samples:\n' + JSON.stringify(endpoints, null, 2);
        endpointSamples += '\n\nFor each action, use the endpoint sample_request as a guide for the payload shape. Fill in the actual values for the keys you decide. The engine will merge your payload with the endpoint defaults.';
      }
    }
  }

  const userPrompt = `${renderedInstructions || ''}${endpointSamples}\n\nReturn ONLY valid JSON matching this schema:\n${schemaJson}`;

  // Wrap AI call + action execution + post-processing in a timeout race
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Step execution timed out after 60s')), STEP_TIMEOUT_MS);
  });

  const executionPromise = (async (): Promise<string | { status: 'paused'; stepRunId: string } | null> => {
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
    const schema = buildExpectedResponseSchema(step.expected_response);
    const zodResult = schema.safeParse(aiResponse);
    console.log(`[engine] zod validation:`, JSON.stringify(zodResult, null, 2));

    if (!zodResult.success) {
      const zodError = zodResult.error.flatten();
      console.error(`[engine] zod validation FAILED:`, JSON.stringify(zodError, null, 2));
      // Call pro_check on the validation error — Prolog may decide a correction flow is needed
      const zodOutput = { zod_error: zodError, ai_response: aiResponse };
      const { data: stepRunForZod } = await getSupabase()
        .from('step_runs')
        .select('*')
        .eq('id', stepRunId)
        .maybeSingle();
      if (stepRunForZod) {
        const rules: string[] = [];
        const plans: string[] = [];
        if (step.rules && Array.isArray(step.rules)) rules.push(...step.rules);
        if (step.plans && Array.isArray(step.plans)) plans.push(...step.plans);
        if (context.plan_id) plans.push(context.plan_id);
        const proCheckResult = await callProCheckOnOutput(stepRunForZod, zodOutput, rules, plans);
        if (proCheckResult === 'paused') return { status: 'paused', stepRunId };
      }
      // If pro_check passed (or no correction), fail the step
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

    // Auto-store top-level scalar fields from AI response as flow_run variables
    // so subsequent steps can reference them via [[var:key]]
    for (const [key, value] of Object.entries(validated)) {
      if (key === 'next' || key === 'actions' || key === 'pro_check') continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await getSupabase().from('variables').insert({
          id: randomUUID(),
          flow_run_id: flowRunId,
          step_run_id: stepRunId,
          key,
          value: String(value),
          scope: 'flow_run',
          created_at: new Date().toISOString(),
        }).maybeSingle();
        // Also add to running context immediately
        context[key] = value;
      }
    }

    // Step 5 — Call pro_check on the validated AI response output
    const { data: stepRunForProCheck } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('id', stepRunId)
      .maybeSingle();
    if (stepRunForProCheck) {
      const rules: string[] = [];
      const plans: string[] = [];
      if (step.rules && Array.isArray(step.rules)) rules.push(...step.rules);
      if (step.plans && Array.isArray(step.plans)) plans.push(...step.plans);
      if (context.plan_id) plans.push(context.plan_id);
      const proCheckResult = await callProCheckOnOutput(stepRunForProCheck, validated, rules, plans);
      if (proCheckResult === 'paused') return { status: 'paused', stepRunId };
    }

    // Step 6 — Execute actions (ONLY after pro_check pass)
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
        url = normalizeValue(resolveVariables(endpoint.url, context));
        headers = { ...(endpoint.headers || {}), ...headers };
      }

      let mergedPayload: any = undefined;

      // Start from endpoint default (if exists)
      if (endpoint?.sample_request) {
        mergedPayload = { ...endpoint.sample_request };
      }

      // Apply AI payload (override defaults)
      if (action.payload) {
        const resolvedPayload = normalizeValue(resolveVariables(action.payload, context));
        mergedPayload = mergedPayload
          ? deepMerge(mergedPayload, resolvedPayload)
          : resolvedPayload;
      }

      console.log(`[engine] executing action: ${action.method || 'GET'} ${url}`);
      const res = await fetch(url, {
        method: (action.method || 'GET').toUpperCase(),
        headers,
        body: mergedPayload ? JSON.stringify(mergedPayload) : undefined,
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
        request_body: mergedPayload,
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
        const bodyStr = responseBody || '';
        const shouldPause = await handleApiFailure(bodyStr, res.status, url, context, stepRunId, flowRunId, step);
        if (shouldPause === 'paused') {
          // Signal pause to outer runFlow without throwing
          return { status: 'paused', stepRunId };
        }
        // pro_check passed despite API error — mark step failed and stop
        // Merge result to preserve any existing fields (e.g. pro_check_request)
        const { data: failedStepRun } = await getSupabase()
          .from('step_runs')
          .select('result')
          .eq('id', stepRunId)
          .maybeSingle();
        const failedResult = failedStepRun?.result && typeof failedStepRun.result === 'object' ? failedStepRun.result : {};
        await updateStepRun(stepRunId, {
          status: 'failed',
          error: `API ${res.status}: ${(bodyStr || '').slice(0, 500)}`,
          result: { ...failedResult, api_error: { statusCode: res.status, body: bodyStr, url } },
        });
        throw new Error(`API call failed: ${url} ${res.status}`);
      }
      console.log(`[engine] action completed: ${url} ${res.status}`);
    }

    // Step 7 — Call pro_check on the final output (after all actions)
    const finalOutput = { ...validated, actions_completed: actions.map(a => a.endpoint) };
    const { data: stepRunAfterActions } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('id', stepRunId)
      .maybeSingle();
    if (stepRunAfterActions) {
      const rules: string[] = [];
      const plans: string[] = [];
      if (step.rules && Array.isArray(step.rules)) rules.push(...step.rules);
      if (step.plans && Array.isArray(step.plans)) plans.push(...step.plans);
      if (context.plan_id) plans.push(context.plan_id);
      const proCheckResult = await callProCheckOnOutput(stepRunAfterActions, finalOutput, rules, plans);
      if (proCheckResult === 'paused') return { status: 'paused', stepRunId };
    }

    // Step 8 — Persist everything
    const trace = {
      zod_result: 'valid',
      step: 'completed',
    };

    await updateStepRun(stepRunId, {
      ai_response: normalizeValue(validated),
      ai_response_valid: true,
      rendered_instructions: renderedInstructions,
      resolved_variables: context,
      trace,
      status: 'completed',
    });

    // Write refs entries for rules and plans from step metadata
    const stepRules: string[] = [];
    const stepPlans: string[] = [];
    if (validated.pro_check?.rules) stepRules.push(...validated.pro_check.rules);
    if (validated.pro_check?.plans) stepPlans.push(...validated.pro_check.plans);
    if (step.rules && Array.isArray(step.rules)) stepRules.push(...step.rules);
    if (step.plans && Array.isArray(step.plans)) stepPlans.push(...step.plans);
    for (const ruleId of stepRules) {
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
    for (const planId of stepPlans) {
      await getSupabase().from('refs').insert({
        id: randomUUID(),
        flow_run_id: flowRunId,
        step_run_id: stepRunId,
        rule_id: planId,
        key: 'plan',
        value: 'referenced',
        source: 'pro_check',
        created_at: new Date().toISOString(),
      }).maybeSingle();
    }

    // Step 9 — Conditions override
    const conditionResult = await evaluateConditions(step.id, validated);
    if (conditionResult === '__PAUSED__') {
      // Condition matched but had no next_step_id or next_flow_id — pause for Mo
      console.log(`[engine] step=${step.ref} condition matched, pausing for Mo`);
      await updateFlowRun(flowRunId, {
        status: 'paused',
        paused_at_step_id: step.id,
      });
      return '__PAUSED__';
    }
    if (conditionResult) {
      console.log(`[engine] step=${step.ref} next=${conditionResult} (condition)`);
      return conditionResult;
    }

    // Step 10 — Direct transition
    if (next) {
      console.log(`[engine] step=${step.ref} next=${next}`);
      return next;
    }

    // Terminal step — no outgoing edge, pause for Mo
    console.log(`[engine] step=${step.ref} is terminal, pausing for Mo`);
    await updateFlowRun(flowRunId, {
      status: 'paused',
      paused_at_step_id: step.id,
    });
    return '__PAUSED__';
  })();

  let executionResult: any;
  try {
    executionResult = await Promise.race([executionPromise, timeoutPromise]);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timed out after 60s');
    console.error(`[engine] step execution error:`, msg);

    if (isTimeout) {
      // Timeout — mark step as failed and trigger pro_check via handleApiFailure
      await updateStepRun(stepRunId, {
        status: 'failed',
        error: msg,
        result: { timeout: true, error: msg },
      });
      // Trigger pro_check so correction flow can be started
      await handleApiFailure(
        JSON.stringify({ timeout: true, error: msg }),
        408,
        'step://timeout',
        context,
        stepRunId,
        flowRunId,
        step,
      );
      return { status: 'paused', stepRunId };
    }

    // Re-throw non-timeout errors
    throw err;
  }

  // Propagate result from execution promise
  return executionResult;
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

async function getNextStepByOrder(flowId: string, currentOrderIndex: number): Promise<any> {
  const { data, error } = await getSupabase()
    .from('steps')
    .select('*')
    .eq('flow_id', flowId)
    .gt('order_index', currentOrderIndex)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to get next step: ${error.message}`);
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

export async function createFlowRun(flowId: string, inputVariables?: Record<string, any>): Promise<string> {
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

  // Store input variables as flow_run-scoped variable records
  if (inputVariables && typeof inputVariables === 'object') {
    for (const [key, value] of Object.entries(inputVariables)) {
      const { error: varError } = await getSupabase()
        .from('variables')
        .insert({
          id: randomUUID(),
          flow_run_id: id,
          step_run_id: null,
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          scope: 'flow_run',
          created_at: new Date().toISOString(),
        });
      if (varError) {
        console.warn(`[engine] failed to store input variable ${key}:`, varError.message);
      }
    }
  }

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
    // c.type is the field name in the AI response to check (e.g. "var_plan_id")
    if (!(c.type in expected)) continue;

    if (expected[c.type] === c.value) {
      // next_flow_id takes priority — jump to another flow
      if (c.next_flow_id) {
        const firstStep = await getFirstStep(c.next_flow_id);
        if (!firstStep) throw new Error(`No steps found in target flow ${c.next_flow_id}`);
        return firstStep.ref;
      }

      // next_step_id — continue in the same flow
      if (c.next_step_id) {
        const step = await getStepById(c.next_step_id);
        if (!step?.ref) {
          throw new Error(`Step ${c.next_step_id} has no ref`);
        }
        return step.ref;
      }

      // No next_step_id or next_flow_id — pause for Mo intervention.
      // If resume_step_id is set, store it so resume knows where to go.
      if (c.resume_step_id) {
        // The caller (runStep) will handle the pause; we signal by returning '__PAUSED__'
        // and the resume_step_id is stored on the condition for the resume logic to use.
        return '__PAUSED__';
      }

      // No next edge at all — pause
      return '__PAUSED__';
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

function deepMerge(base: any, override: any): any {
  if (typeof base !== 'object' || base === null) return override;
  if (typeof override !== 'object' || override === null) return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;

  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }

  return result;
}
