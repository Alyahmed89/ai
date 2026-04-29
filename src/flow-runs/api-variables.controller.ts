import { Controller, Get, Post, Body } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

@Controller('api/variables')
export class ApiVariablesController {
  @Get()
  async list() {
    const { data } = await supabase.from('variables').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { name: string; value?: any; scope?: string; flow_run_id?: string; step_run_id?: string }) {
    const { data } = await supabase.from('variables').insert({
      id: crypto.randomUUID(),
      key: body.name,
      value: body.value || null,
      scope: body.scope || 'flow',
      flow_run_id: body.flow_run_id || null,
      step_run_id: body.step_run_id || null,
      created_at: new Date().toISOString(),
    }).select().single();
    return data;
  }
}
