import { Controller, Get, Param, Query } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/step-runs')
export class ApiStepRunsController {
  @Get(':id')
  async get(@Param('id') id: string, @Query('include_step') includeStep?: string) {
    const { data: stepRun, error } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !stepRun) {
      return { error: 'Step run not found' };
    }

    const result: Record<string, any> = { ...stepRun };

    if (includeStep === 'true') {
      // Fetch step definition
      const { data: step } = await getSupabase()
        .from('steps')
        .select('*')
        .eq('id', stepRun.step_id)
        .single();

      // Fetch conditions
      const { data: conditions } = await getSupabase()
        .from('step_conditions')
        .select('*')
        .eq('step_id', stepRun.step_id);

      result.step = step || null;
      result.conditions = conditions || [];
    }

    return result;
  }

  @Get()
  async list(@Query('flow_run_id') flowRunId: string, @Query('include_step') includeStep?: string) {
    const { data: stepRuns } = await getSupabase()
      .from('step_runs')
      .select('*')
      .eq('flow_run_id', flowRunId)
      .order('created_at', { ascending: true });

    if (!stepRuns || stepRuns.length === 0) return [];

    if (includeStep === 'true') {
      // Fetch step definitions for all step IDs
      const stepIds = [...new Set(stepRuns.map(sr => sr.step_id))];
      const { data: steps } = await getSupabase()
        .from('steps')
        .select('*')
        .in('id', stepIds);

      // Fetch conditions for all step IDs
      const { data: conditions } = await getSupabase()
        .from('step_conditions')
        .select('*')
        .in('step_id', stepIds);

      // Build lookup maps
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

      // Merge step definitions and conditions into each step run
      return stepRuns.map(sr => ({
        ...sr,
        step: stepMap[sr.step_id] || null,
        conditions: condMap[sr.step_id] || [],
      }));
    }

    return stepRuns;
  }
}
