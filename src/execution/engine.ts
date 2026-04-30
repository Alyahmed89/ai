import { getSupabase } from '../supabase';

const AiResponseSchema = {
  response: (v: unknown): v is string => typeof v === 'string',
};

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
  const vars = await getVariables(flowRunId);

  let rendered = step.instructions || '';
  for (const v of vars) {
    rendered = rendered.replace(new RegExp(`{{${v.key}}}`, 'g'), String(v.value));
  }

  await updateStepRun(stepRunId, {
    rendered_instructions: rendered,
    resolved_variables: vars,
  });

  const aiResult = await callAI(rendered);

  if (!aiResult || typeof aiResult.response !== 'string') {
    throw new Error(`Invalid AI response format for step ${step.ref}`);
  }

  await updateStepRun(stepRunId, { ai_response: aiResult, ai_response_valid: true });

  // Evaluate conditions from step_conditions table
  const conditionNextRef = await evaluateConditions(step.id, aiResult);
  if (conditionNextRef) {
    console.log(`step=${step.ref} response=${aiResult.response} next=${conditionNextRef}`);
    await updateStepRun(stepRunId, { status: 'completed' });
    return conditionNextRef;
  }

  if (aiResult.response === 'end') {
    console.log(`step=${step.ref} response=end`);
    await updateStepRun(stepRunId, { status: 'completed' });
    return null;
  }

  if (aiResult.response.startsWith('next:')) {
    const ref = aiResult.response.slice(5);
    if (!ref) throw new Error(`Empty ref in next: for step ${step.ref}`);
    console.log(`step=${step.ref} response=${aiResult.response} next=${ref}`);
    await updateStepRun(stepRunId, { status: 'completed' });
    return ref;
  }

  throw new Error(`Invalid response "${aiResult.response}" from step ${step.ref}`);
}

/**
 * Strict deterministic parser.
 * Input: rendered instructions string.
 * Output: { response: "next:<ref>" } | { response: "end" }
 */
async function callAI(instructions: string): Promise<{ response: string }> {
  const lower = instructions.toLowerCase().trim();

  // Match "next:<ref>" pattern
  const nextMatch = lower.match(/next:\s*(\S+)/);
  if (nextMatch) {
    return { response: `next:${nextMatch[1]}` };
  }

  // Match "end"
  if (lower === 'end' || lower.endsWith(' end')) {
    return { response: 'end' };
  }

  return { response: 'end' };
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
  const { data, error } = await getSupabase()
    .from('flow_runs')
    .insert({
      flow_id: flowId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create flow run: ${error.message}`);
  return data.id;
}

async function updateFlowRun(flowRunId: string, data: any): Promise<void> {
  const { error } = await getSupabase()
    .from('flow_runs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', flowRunId);
  if (error) throw new Error(`Failed to update flow run: ${error.message}`);
}

async function getVariables(flowRunId: string): Promise<any[]> {
  const { data, error } = await getSupabase()
    .from('variables')
    .select('key, value')
    .eq('flow_run_id', flowRunId);
  if (error) throw new Error(`Failed to get variables: ${error.message}`);
  return data || [];
}

async function evaluateConditions(stepId: string, response: any): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('step_conditions')
    .select('*')
    .eq('step_id', stepId);
  if (error) throw new Error(`Failed to get conditions: ${error.message}`);

  if (!data || data.length === 0) return null;

  for (const c of data) {
    if (c.type === 'contains' && response.response?.includes(c.value)) {
      return c.next_step_ref || null;
    }
  }

  return null;
}
