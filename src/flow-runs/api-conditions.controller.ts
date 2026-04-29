import { Controller, Post, Body } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

@Controller('api/conditions')
export class ApiConditionsController {
  @Post()
  async create(@Body() body: { step_id: string; type: string; value?: string; next_step_id?: string; next_flow_id?: string }) {
    const { data } = await supabase.from('step_conditions').insert({
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
}
