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
  async create(@Body() body: { name: string; url: string; method: string; headers?: any; sample_request?: any; sample_response?: any }) {
    const { data } = await getSupabase().from('endpoint_registry').insert({
      id: crypto.randomUUID(),
      name: body.name,
      url: body.url,
      method: body.method.toUpperCase(),
      headers: body.headers || null,
      sample_request: body.sample_request || null,
      sample_response: body.sample_response || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; url?: string; method?: string; headers?: any; sample_request?: any; sample_response?: any }) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.url !== undefined) updates.url = body.url;
    if (body.method !== undefined) updates.method = body.method.toUpperCase();
    if (body.headers !== undefined) updates.headers = body.headers;
    if (body.sample_request !== undefined) updates.sample_request = body.sample_request;
    if (body.sample_response !== undefined) updates.sample_response = body.sample_response;
    const { data } = await getSupabase().from('endpoint_registry').update(updates).eq('id', id).select().single();
    return data;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await getSupabase().from('endpoint_registry').delete().eq('id', id);
    return { success: true };
  }
}
