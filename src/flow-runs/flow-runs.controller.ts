import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
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
  async resume(@Param('id') id: string, @Body() body: { user_input?: Record<string, any> }) {
    return this.flowRunsService.resume(id, body.user_input);
  }

  @Get(':id/run')
  async run(@Param('id') id: string) {
    return this.flowRunsService.runStep(id);
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

    // Enrich step runs with step definitions and conditions
    let enrichedStepRuns = stepRuns.data || [];
    if (enrichedStepRuns.length > 0) {
      const stepIds = [...new Set(enrichedStepRuns.map((sr: any) => sr.step_id))];
      const { data: steps } = await getSupabase()
        .from('steps')
        .select('*')
        .in('id', stepIds);
      const { data: conditions } = await getSupabase()
        .from('step_conditions')
        .select('*')
        .in('step_id', stepIds);

      const stepMap: Record<string, any> = {};
      if (steps) {
        for (const s of steps) {
          const { id, title, ref, instructions, expected_response, order_index, system_message } = s;
          stepMap[s.id] = { id, title, ref, instructions, expected_response, order_index, system_message };
        }
      }

      const condMap: Record<string, any[]> = {};
      if (conditions) {
        for (const c of conditions) {
          if (!condMap[c.step_id]) condMap[c.step_id] = [];
          condMap[c.step_id].push(c);
        }
      }

      enrichedStepRuns = enrichedStepRuns.map((sr: any) => ({
        ...sr,
        step: stepMap[sr.step_id] || null,
        conditions: condMap[sr.step_id] || [],
      }));
    }

    return res.json({
      flowRun: flowRun.data,
      stepRuns: enrichedStepRuns,
      apiCalls: apiCalls.data,
    });
  }

  @Get(':id/events')
  async events(@Param('id') id: string) {
    const { data } = await getSupabase()
      .from('execution_events')
      .select('*')
      .eq('flow_run_id', id)
      .order('created_at', { ascending: true });
    return data || [];
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('execution_events').delete().eq('flow_run_id', id);
    await getSupabase().from('refs').delete().eq('flow_run_id', id);
    await getSupabase().from('api_calls').delete().eq('flow_run_id', id);
    await getSupabase().from('step_runs').delete().eq('flow_run_id', id);
    await getSupabase().from('variables').delete().eq('flow_run_id', id);
    await getSupabase().from('flow_runs').delete().eq('id', id);
    return { success: true };
  }
}
