import { Controller, Get, Query } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

@Controller('api/step-runs')
export class ApiStepRunsController {
  @Get()
  async list(@Query('flow_run_id') flowRunId: string) {
    const { data } = await supabase
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', flowRunId)
      .order('created_at', { ascending: true });
    return data || [];
  }
}
