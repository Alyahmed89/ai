import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/flows')
export class ApiFlowsController {
  @Get()
  async list() {
    const { data } = await getSupabase().from('flows').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { title: string; description?: string }) {
    const { data } = await getSupabase().from('flows').insert({
      id: crypto.randomUUID(),
      name: body.title,
      description: body.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Delete child records first
    const { data: flowRuns } = await getSupabase().from('flow_runs').select('id').eq('flow_id', id);
    if (flowRuns) {
      const runIds = flowRuns.map(r => r.id);
      if (runIds.length > 0) {
        await getSupabase().from('refs').delete().in('flow_run_id', runIds);
        await getSupabase().from('api_calls').delete().in('flow_run_id', runIds);
        await getSupabase().from('step_runs').delete().in('flow_run_id', runIds);
        await getSupabase().from('variables').delete().in('flow_run_id', runIds);
        await getSupabase().from('flow_runs').delete().in('id', runIds);
      }
    }
    const { data: steps } = await getSupabase().from('steps').select('id').eq('flow_id', id);
    if (steps) {
      const stepIds = steps.map(s => s.id);
      if (stepIds.length > 0) {
        await getSupabase().from('step_conditions').delete().in('step_id', stepIds);
        await getSupabase().from('steps').delete().in('id', stepIds);
      }
    }
    await getSupabase().from('flows').delete().eq('id', id);
    return { success: true };
  }
}
