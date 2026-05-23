import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/endpoints')
export class ApiEndpointsController {
  @Get()
  async list() {
    const { data } = await getSupabase().from('endpoint_registry').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { name?: string; url: string; method: string; headers?: any; description?: string; sample_request?: any; sample_response?: any }) {
    const { data } = await getSupabase().from('endpoint_registry').insert({
      id: body.name || crypto.randomUUID(),
      url: body.url,
      method: body.method.toUpperCase(),
      headers: body.headers || null,
      description: body.description || (body.sample_request || body.sample_response ? JSON.stringify({ sample_request: body.sample_request, sample_response: body.sample_response }) : null),
      created_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { url?: string; method?: string; headers?: any; description?: string }) {
    const updates: any = {};
    if (body.url !== undefined) updates.url = body.url;
    if (body.method !== undefined) updates.method = body.method.toUpperCase();
    if (body.headers !== undefined) updates.headers = body.headers;
    if (body.description !== undefined) updates.description = body.description;
    const { data } = await getSupabase().from('endpoint_registry').update(updates).eq('id', id).select().single();
    return data;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('endpoint_registry').delete().eq('id', id);
    return { success: true };
  }
}
