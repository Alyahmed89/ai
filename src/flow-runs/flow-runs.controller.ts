import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { FlowRunsService } from './flow-runs.service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

@Controller('flow-runs')
export class FlowRunsController {
  constructor(private flowRunsService: FlowRunsService) {}

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    return this.flowRunsService.resume(id);
  }

  @Get(':id/trace')
  async trace(@Param('id') id: string, @Res() res: Response) {
    const flowRun = await supabase
      .from('flow_runs')
      .select('*')
      .eq('id', id)
      .single();

    const stepRuns = await supabase
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', id)
      .order('created_at', { ascending: true });

    const apiCalls = await supabase
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
