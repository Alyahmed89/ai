import { randomUUID } from 'crypto';
import { getSupabase } from '../supabase';

export async function runFlow(flowRunId: string): Promise<void> {
  await updateFlowRun(flowRunId, { status: 'running' });

  const flowRun = await getFlowRun(flowRunId);
  if (!flowRun?.flow_id) throw new Error(`Flow run ${flowRunId} has no flow_id`);

  const firstStep = await getFirstStep(flowRun.flow_id);
  if (!firstStep) throw new Error(`No steps found for flow ${flowRun.flow_id}`);

  const visited = new Set<string>();
  const maxSteps = 50;
  let stepCount = 0;
  let currentStep = firstStep;

  while (currentStep) {
    if (stepCount >= maxSteps) throw new Error('Max steps exceeded');
    if (visited.has(currentStep.id)) throw new Error('Cycle detected');
    visited.add(currentStep.id);
    stepCount++;

    const nextRef = await runStep(currentStep, flowRunId);
    if (!nextRef) break;

    const nextStep = await getStepByFlowAndRef(flowRun.flow_id, nextRef);
    if (!nextStep) throw new Error(`Step ref "${nextRef}" not found in flow ${flowRun.flow_id}`);
    currentStep = nextStep;
  }

  await updateFlowRun(flowRunId, { status: 'completed' });
}

async function runStep(step: any, flowRunId: string): Promise<string | null> {
  const stepRunId = await createStepRun(flowRunId, step.id);

  const expected = step.expected_response;
  if (!expected || typeof expected !== 'object') {
    throw new Error(`Step ${step.ref} has invalid expected_response`);
  }

  const next = expected.next ?? null;
  const actions = Array.isArray(expected.actions) ? expected.actions : [];

  // Execute actions
  for (const action of actions) {
    if (action.type !== 'api') continue;

    let url = action.endpoint;
    let headers: Record<string, string> = { 'Content-Type': 'application/json', ...(action.headers || {}) };

    const { data: endpoint } = await getSupabase()
      .from('endpoint_registry')
      .select('*')
      .eq('name', action.endpoint)
      .maybeSingle();

    if (endpoint) {
      url = endpoint.url;
      headers = { ...(endpoint.headers || {}), ...headers };
    }

    const res = await fetch(url, {
      method: (action.method || 'GET').toUpperCase(),
      headers,
      body: action.payload ? JSON.stringify(action.payload) : undefined,
    });

    if (!res.ok) {
      throw new Error(`API call failed: ${url} ${res.status}`);
    }
  }

  await updateStepRun(stepRunId, {
    ai_response: expected,
    ai_response_valid: true,
    status: 'completed',
  });

  // Conditions override
  const conditionNextRef = await evaluateConditions(step.id, expected);
  if (conditionNextRef) {
    console.log(`step=${step.ref} next=${conditionNextRef} (condition)`);
    return conditionNextRef;
  }

  // Direct transition
  if (next) {
    console.log(`step=${step.ref} next=${next}`);
    return next;
  }

  throw new Error(`Step ${step.ref} has no next and no condition matched`);
}

async function getFlowRun(flowRunId: string): Promise<any> {
  const { data, error } = await getSupabase()
    .from('flow_runs')
    .select('flow_id')
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
    .single();
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
  const { data, error } = await getSupabase()
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
