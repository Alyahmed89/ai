import { Controller, Get, Post, Body } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

@Controller('api/endpoints')
export class ApiEndpointsController {
  @Get()
  async list() {
    const { data } = await supabase.from('endpoint_registry').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { name: string; url: string; method: string; headers?: any }) {
    const { data } = await supabase.from('endpoint_registry').insert({
      id: crypto.randomUUID(),
      name: body.name,
      url: body.url,
      method: body.method.toUpperCase(),
      headers: body.headers || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();
    return data;
  }
}
