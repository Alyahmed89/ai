import { Controller, Get, Param } from '@nestjs/common';
import { getSupabase } from '../supabase';

@Controller('flow-runs')
export class ContextController {
  @Get(':id/context')
  async getContext(@Param('id') id: string) {
    const [flowRunResult, stepRunsResult, stepsResult, variablesResult] = await Promise.all([
      getSupabase().from('flow_runs').select('*').eq('id', id).single(),
      getSupabase().from('step_runs').select('*').eq('flow_run_id', id).order('created_at', { ascending: true }),
      getSupabase().from('steps').select('*'),
      getSupabase().from('variables').select('*').or(`flow_run_id.eq.${id},scope.eq.global`),
    ]);

    const flowRun = flowRunResult.data || {};
    const stepRuns = stepRunsResult.data || [];
    const allSteps = stepsResult.data || [];
    const variables = variablesResult.data || [];

    // Get the flow_id from the flow run to filter steps
    const flowId = flowRun.flow_id;
    const steps = flowId ? allSteps.filter((s: any) => s.flow_id === flowId) : [];

    // Organize variables by scope
    const globalVars: Record<string, any> = {};
    const flowVars: Record<string, any> = {};
    const flowRunVars: Record<string, any> = {};
    const stepVars: Record<string, any> = {};
    const stepRunVars: Record<string, any> = {};

    for (const v of variables) {
      if (v.scope === 'global') {
        globalVars[v.key] = v.value;
      } else if (v.scope === 'flow') {
        flowVars[v.key] = v.value;
      } else if (v.scope === 'flow_run') {
        flowRunVars[v.key] = v.value;
      } else if (v.scope === 'step') {
        stepVars[v.key] = v.value;
      } else if (v.scope === 'step_run') {
        stepRunVars[v.key] = v.value;
      }
    }

    return {
      flow_run: flowRun,
      steps,
      step_runs: stepRuns,
      variables: {
        global: globalVars,
        flow: flowVars,
        flow_run: flowRunVars,
        step: stepVars,
        step_run: stepRunVars,
      },
      available_variables: ['goal', 'memory', 'memory_prompt'],
    };
  }

  @Get(':id/steps/:stepId/context')
  async getStepContext(@Param('id') id: string, @Param('stepId') stepId: string) {
    const [flowRunResult, stepRunsResult, stepsResult, variablesResult] = await Promise.all([
      getSupabase().from('flow_runs').select('*').eq('id', id).single(),
      getSupabase().from('step_runs').select('*').eq('flow_run_id', id).eq('step_id', stepId).order('created_at', { ascending: true }),
      getSupabase().from('steps').select('*'),
      getSupabase().from('variables').select('*').or(`flow_run_id.eq.${id},scope.eq.global`),
    ]);

    const flowRun = flowRunResult.data || {};
    const stepRuns = stepRunsResult.data || [];
    const allSteps = stepsResult.data || [];
    const variables = variablesResult.data || [];

    // Get the flow_id from the flow run to filter steps
    const flowId = flowRun.flow_id;
    const steps = flowId ? allSteps.filter((s: any) => s.flow_id === flowId && s.id === stepId) : [];

    // Organize variables by scope
    const globalVars: Record<string, any> = {};
    const flowVars: Record<string, any> = {};
    const flowRunVars: Record<string, any> = {};
    const stepVars: Record<string, any> = {};
    const stepRunVars: Record<string, any> = {};

    for (const v of variables) {
      if (v.scope === 'global') {
        globalVars[v.key] = v.value;
      } else if (v.scope === 'flow') {
        flowVars[v.key] = v.value;
      } else if (v.scope === 'flow_run') {
        flowRunVars[v.key] = v.value;
      } else if (v.scope === 'step') {
        stepVars[v.key] = v.value;
      } else if (v.scope === 'step_run') {
        stepRunVars[v.key] = v.value;
      }
    }

    return {
      flow_run: flowRun,
      steps,
      step_runs: stepRuns,
      variables: {
        global: globalVars,
        flow: flowVars,
        flow_run: flowRunVars,
        step: stepVars,
        step_run: stepRunVars,
      },
    };
  }
}
