import { Controller, Get, Query } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/step-runs')
export class ApiStepRunsController {
  @Get()
  async list(@Query('flow_run_id') flowRunId: string) {
    const { data } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', flowRunId)
      .order('created_at', { ascending: true });
    return data || [];
  }
}
