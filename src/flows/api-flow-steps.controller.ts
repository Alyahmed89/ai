import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/flow-steps')
export class ApiFlowStepsController {
  @Get()
  async list(@Query('flow_id') flowId?: string) {
    let query = getSupabase().from('steps').select('*');
    if (flowId) {
      query = query.eq('flow_id', flowId);
    }
    const { data } = await query.order('order_index', { ascending: true });
    return data || [];
  }

  @Post()
  async create(@Body() body: { flow_id: string; title: string; system_message?: string; instructions: string; expected_response: any; order_index?: number }) {
    const { data } = await getSupabase().from('steps').insert({
      id: crypto.randomUUID(),
      flow_id: body.flow_id,
      title: body.title,
      system_message: body.system_message || null,
      instructions: body.instructions,
      expected_response: body.expected_response,
      order_index: body.order_index ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { title?: string; system_message?: string; instructions?: string; expected_response?: any; order_index?: number }) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.system_message !== undefined) updates.system_message = body.system_message;
    if (body.instructions !== undefined) updates.instructions = body.instructions;
    if (body.expected_response !== undefined) updates.expected_response = body.expected_response;
    if (body.order_index !== undefined) updates.order_index = body.order_index;
    const { data } = await getSupabase().from('steps').update(updates).eq('id', id).select().single();
    return data;
  }
}
