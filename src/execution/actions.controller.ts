import { Controller, Post, Body, Param } from '@nestjs/common';
import { FlowsService } from '../flows/flows.service';
import { FlowRunsService } from '../flow-runs/flow-runs.service';
import { getSupabase } from '../supabase';
import { runStep, getFlowRun, getStepById } from './engine';

@Controller()
export class ActionsController {
  constructor(
    private flowsService: FlowsService,
    private flowRunsService: FlowRunsService
  ) {}

  @Post('start')
  async start(@Body() body: { flowId: string; input_variables?: Record<string, any> }) {
    const res = await this.flowsService.start(body.flowId, body.input_variables);
    return { flowRunId: res.flowRunId };
  }

  @Post('resume')
  async resume(@Body() body: { flowRunId: string; user_input?: any }) {
    await this.flowRunsService.resume(body.flowRunId, body.user_input);
    return { flowRunId: body.flowRunId };
  }

  @Post('flow-runs/:id/replay')
  async replay(@Param('id') id: string, @Body() body: { step_id: string }) {
    const flowRun = await getFlowRun(id);
    if (!flowRun) throw new Error(`Flow run ${id} not found`);
    if (flowRun.status !== 'paused' && flowRun.status !== 'running') {
      throw new Error(`Flow run ${id} is in status '${flowRun.status}', expected 'paused' or 'running'`);
    }

    const step = await getStepById(body.step_id);
    if (!step) throw new Error(`Step ${body.step_id} not found`);

    await runStep(step, id, flowRun);

    // Fetch the newly created step_run
    const { data: stepRun } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', id)
      .eq('step_id', body.step_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { step_run: stepRun };
  }
}
