import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { getSupabase } from '../supabase';
import { FlowRunsService } from './flow-runs.service';


@Controller('flow-runs')
export class FlowRunsController {
  constructor(private flowRunsService: FlowRunsService) {}

  @Get()
  async list() {
    const { data } = await getSupabase()
      .from('flow_runs')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    return this.flowRunsService.resume(id);
  }

  @Get(':id/trace')
  async trace(@Param('id') id: string, @Res() res: Response) {
    const flowRun = await getSupabase()
      .from('flow_runs')
      .select('*')
      .eq('id', id)
      .single();

    const stepRuns = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', id)
      .order('created_at', { ascending: true });

    const apiCalls = await getSupabase()
      .from('api_calls')
      .select('*')
      .eq('flow_run_id', id)
      .order('created_at', { ascending: true });

    return res.json({
      flowRun: flowRun.data,
      stepRuns: stepRuns.data,
      apiCalls: apiCalls.data,
    });
  }
}
