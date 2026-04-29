import { z } from 'zod';
import { getSupabase } from '../supabase';

const AiResponseSchema = z.object({
  response: z.string(),
  actions: z.array(
    z.object({
      type: z.literal('call'),
      endpoint: z.string(),
      params: z.any(),
    }),
  ),
});

export async function runFlow(flowRunId: string): Promise<void> {
  await updateFlowRun(flowRunId, { status: 'running' });
  try {
    const stepId = await getFirstStep(flowRunId);
    if (!stepId) return;
    let current: string | null = stepId;
    while (current) {
      current = await runStep(current, flowRunId);
    }
    await updateFlowRun(flowRunId, { status: 'completed' });
  } catch (err) {
    await updateFlowRun(flowRunId, { status: 'failed', error: String(err) });
  }
}

async function runStep(stepId: string, flowRunId: string): Promise<string | null> {
  const stepRunId = await createStepRun(flowRunId, stepId);
  const step = await getStep(stepId);
  const vars = await getVariables(flowRunId);

  let rendered = step?.instructions || '';
  const newVars: Record<string, any> = {};
  const newApiCalls: any[] = [];
  const newQueries: any[] = [];
  const newRules: string[] = [];

  for (const v of vars) {
    rendered = rendered.replace(new RegExp(`{{${v.key}}}`, 'g'), String(v.value));
    newVars[v.key] = v.value;
    await insertRef({ flow_run_id: flowRunId, step_run_id: stepRunId, key: v.key, value: JSON.stringify(v.value), source: 'variable' });
  }

  await updateStepRun(stepRunId, {
    rendered_instructions: rendered,
    resolved_variables: vars,
  });

  let aiResult = await callAI(rendered);

  let valid = validateResponse(aiResult);
  if (!valid) {
    console.log('VALIDATION FAILED', aiResult);
    aiResult = await callAI(rendered);
    valid = validateResponse(aiResult);
    if (!valid) {
      console.log('VALIDATION FAILED', aiResult);
      await updateStepRun(stepRunId, { status: 'failed', error: 'validation failed after retry' });
      return null;
    }
  }

  await updateStepRun(stepRunId, { ai_response: aiResult, ai_response_valid: valid });

  for (const a of aiResult.actions) {
    await saveApiCall({
      flowRunId,
      stepRunId,
      endpoint: a.endpoint,
      params: a.params,
    });
    await setVariable(flowRunId, a.endpoint, a.params);
    newApiCalls.push({ endpoint: a.endpoint, params: a.params });
    await insertRef({ flow_run_id: flowRunId, step_run_id: stepRunId, key: a.endpoint, value: JSON.stringify(a.params), source: 'api' });
    console.log('API CALL', a.endpoint, a.params);
  }

  const nextStepId = await evaluateConditions(stepId, aiResult);
  await appendTrace(stepRunId, { variables: newVars, api_calls: newApiCalls, queries: newQueries, rules_fired: newRules });
  await updateStepRun(stepRunId, { status: 'completed' });
  return nextStepId;
}

async function appendTrace(stepRunId: string, patch: { variables?: any; api_calls?: any[]; queries?: any[]; rules_fired?: string[] }): Promise<void> {
  const { data: stepRun } = await getSupabase().from('step_runs').select('trace').eq('id', stepRunId).single();
  const existing = stepRun?.trace || {};
  existing.variables = existing.variables || {};
  existing.api_calls = existing.api_calls || [];
  existing.queries = existing.queries || [];
  existing.rules_fired = existing.rules_fired || [];
  const merged = {
    ...existing,
    variables: { ...existing.variables, ...(patch.variables || {}) },
    api_calls: [...existing.api_calls, ...(patch.api_calls || [])],
    queries: [...existing.queries, ...(patch.queries || [])],
    rules_fired: [...existing.rules_fired, ...(patch.rules_fired || [])],
  };
  await getSupabase().from('step_runs').update({ trace: merged, updated_at: new Date().toISOString() }).eq('id', stepRunId);
}

async function insertRef(r: { flow_run_id: string; step_run_id: string; rule_id?: string; key: string; value: string; source: string }): Promise<void> {
  await getSupabase().from('refs').insert({
    id: crypto.randomUUID(),
    flow_run_id: r.flow_run_id,
    step_run_id: r.step_run_id,
    rule_id: r.rule_id || null,
    key: r.key,
    value: r.value,
    source: r.source,
    created_at: new Date().toISOString(),
  });
}

async function callAI(input: string): Promise<any> {
  return {
    response: 'next:step_2',
    actions: [
      {
        type: 'call',
        endpoint: 'test',
        params: { x: 1 },
      },
    ],
  };
}

function validateResponse(response: any): boolean {
  const result = AiResponseSchema.safeParse(response);
  return result.success;
}

async function getFirstStep(flowRunId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('steps')
    .select('id')
    .order('order_index', { ascending: true })
    .limit(1)
    .single();
  return data?.id || null;
}

async function getStep(stepId: string): Promise<any> {
  const { data } = await getSupabase()
    .from('steps')
    .select('*')
    .eq('id', stepId)
    .single();
  return data;
}

async function createStepRun(flowRunId: string, stepId: string): Promise<string> {
  const { data } = await getSupabase()
    .from('step_runs')
    .insert({
      flow_run_id: flowRunId,
      step_id: stepId,
      status: 'running',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return data.id;
}

async function updateStepRun(stepRunId: string, data: any): Promise<void> {
  await getSupabase()
    .from('step_runs')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stepRunId);
}

async function createFlowRun(flowId: string): Promise<string> {
  const { data } = await getSupabase()
    .from('flow_runs')
    .insert({
      flow_id: flowId,
      status: 'running',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return data.id;
}

async function updateFlowRun(flowRunId: string, data: any): Promise<void> {
  await getSupabase()
    .from('flow_runs')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowRunId);
}

async function getVariables(flowRunId: string): Promise<any[]> {
  const { data } = await getSupabase()
    .from('variables')
    .select('key, value')
    .eq('flow_run_id', flowRunId);
  return data || [];
}

async function setVariable(flowRunId: string, key: string, value: any): Promise<void> {
  await getSupabase().from('variables').insert({
    flow_run_id: flowRunId,
    key,
    value,
    scope: 'flow',
    created_at: new Date().toISOString(),
  });
}

async function evaluateConditions(stepId: string, response: any) {
  const { data } = await getSupabase()
    .from('step_conditions')
    .select('*')
    .eq('step_id', stepId);

  if (!data || data.length === 0) return null;

  for (const c of data) {
    if (c.type === 'contains' && response.response.includes(c.value)) {
      return c.next_step_id || null;
    }
  }

  return null;
}

async function saveApiCall(data: {
  flowRunId: string;
  stepRunId: string;
  endpoint: string;
  params: any;
}): Promise<void> {
  await getSupabase().from('api_calls').insert({
    flow_run_id: data.flowRunId,
    step_run_id: data.stepRunId,
    endpoint_name: data.endpoint,
    request_body: data.params,
    created_at: new Date().toISOString(),
  });
}
