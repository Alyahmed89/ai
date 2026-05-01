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
  async create(@Body() body: { flow_id: string; title: string; ref?: string; system_message?: string; instructions: string; expected_response: any; order_index?: number }) {
    if (!body.flow_id) {
      throw new Error('flow_id is required');
    }
    const { data, error } = await getSupabase().from('steps').insert({
      id: crypto.randomUUID(),
      flow_id: body.flow_id,
      title: body.title,
      ref: body.ref || crypto.randomUUID(),
      system_message: body.system_message || null,
      instructions: body.instructions,
      expected_response: body.expected_response,
      order_index: body.order_index ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select();

    console.log('INSERT DATA:', data);
    console.log('INSERT ERROR FULL:', JSON.stringify(error, null, 2));

    if (error) {
      return { insert_error: error, message: error.message, details: error.details, hint: error.hint, code: error.code };
    }

    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { title?: string; ref?: string; system_message?: string; instructions?: string; expected_response?: any; order_index?: number }) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.ref !== undefined) updates.ref = body.ref;
    if (body.system_message !== undefined) updates.system_message = body.system_message;
    if (body.instructions !== undefined) updates.instructions = body.instructions;
    if (body.expected_response !== undefined) updates.expected_response = body.expected_response;
    if (body.order_index !== undefined) updates.order_index = body.order_index;
    const { data } = await getSupabase().from('steps').update(updates).eq('id', id).select().single();
    return data;
  }
}
