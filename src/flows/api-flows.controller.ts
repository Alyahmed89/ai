import { Controller, Get, Post, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/flows')
export class ApiFlowsController {
  @Get()
  async list() {
    const { data } = await getSupabase().from('flows').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  @Post()
  async create(@Body() body: { title: string; description?: string }) {
    const { data } = await getSupabase().from('flows').insert({
      id: crypto.randomUUID(),
      name: body.title,
      description: body.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();
    return data;
  }
}
