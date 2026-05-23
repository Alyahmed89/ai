import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';
import { FlowRunsService } from './flow-runs.service';

@Controller('flow-runs')
export class FlowRunsController {
  constructor(private flowRunsService: FlowRunsService) {}

  @Get()
  async list() {
    const { data } = await getSupabase()
      .from('executions')
      .select('*')
      .eq('type', 'flow')
      .order('created_at', { ascending: false });
    return data || [];
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string, @Body() body: { user_input?: Record<string, any> }) {
    return this.flowRunsService.resume(id, body.user_input);
  }

  @Get(':id/trace')
  async trace(@Param('id') id: string) {
    const { data: flowExec } = await getSupabase()
      .from('executions').select('*').eq('id', id).single();
    const { data: stepExecs } = await getSupabase()
      .from('executions').select('*').eq('parent_id', id).order('created_at', { ascending: true });
    const { data: evts } = await getSupabase()
      .from('events').select('*').eq('execution_id', id).order('created_at', { ascending: true });
    const { data: mem } = await getSupabase()
      .from('memory').select('*').eq('execution_id', id).order('created_at', { ascending: true });
    return { execution: flowExec, steps: stepExecs || [], events: evts || [], memory: mem || [] };
  }

  @Get(':id/events')
  async events(@Param('id') id: string) {
    const { data } = await getSupabase()
      .from('events').select('*').eq('execution_id', id).order('created_at', { ascending: true });
    return data || [];
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('events').delete().eq('execution_id', id);
    await getSupabase().from('memory').delete().eq('execution_id', id);
    await getSupabase().from('executions').delete().eq('parent_id', id);
    await getSupabase().from('executions').delete().eq('id', id);
    return { success: true };
  }
}
