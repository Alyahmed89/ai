import { Controller, Post, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';

@Controller('api/query')
export class ApiQueryController {
  @Post()
  async query(@Body() body: { table: string; select?: string; where?: Record<string, any>; limit?: number }) {
    const limit = Math.min(body.limit || 10, 50);
    const { data, error } = await getSupabase()
      .from(body.table)
      .select(body.select || '*')
      .match(body.where || {})
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
