import { Controller, Post, Delete, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/conditions')
export class ApiConditionsController {
  @Post()
  async create(@Body() body: { step_id: string; type: string; value?: string; next_step_id?: string; next_flow_id?: string }) {
    const { data } = await getSupabase().from('step_conditions').insert({
      id: crypto.randomUUID(),
      step_id: body.step_id,
      type: body.type,
      value: body.value || null,
      next_step_id: body.next_step_id || null,
      next_flow_id: body.next_flow_id || null,
      created_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('step_conditions').delete().eq('id', id);
    return { success: true };
  }
}
