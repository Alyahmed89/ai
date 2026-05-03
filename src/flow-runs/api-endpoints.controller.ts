import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/endpoints')
export class ApiEndpointsController {
  @Get()
  async list() {
    const { data } = await getSupabase().from('endpoint_registry').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { name: string; url: string; method: string; headers?: any }) {
    const { data } = await getSupabase().from('endpoint_registry').insert({
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

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('endpoint_registry').delete().eq('id', id);
    return { success: true };
  }
}
