import { Controller, Post, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';

const PROLOG_URL = process.env.PROLOG_URL || 'https://prolog.anyapp.cfd';

@Controller('api/query')
export class ApiQueryController {
  @Post()
  async query(@Body() body: {
    table: string;
    select?: string;
    filters?: Record<string, any>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    prolog_program?: string;
  }) {
    // Step 1: fetch raw data from Supabase
    let query = getSupabase()
      .from(body.table)
      .select(body.select || '*');

    if (body.filters && Object.keys(body.filters).length > 0) {
      query = query.match(body.filters);
    }
    if (body.order) {
      query = query.order(body.order.column, { ascending: body.order.ascending ?? true });
    }
    const limit = Math.min(body.limit || 100, 1000);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Step 2: if prolog_program provided, filter/sort via Prolog
    if (body.prolog_program) {
      try {
        const resp = await fetch(`${PROLOG_URL}/api/v1/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prolog_program: body.prolog_program,
            response: { rows: data },
            step_run_id: 'query',
          }),
        });
        const result = await resp.json();
        if (result?.filtered_rows) return result.filtered_rows;
      } catch (e) {
        console.error('[api-query] prolog filter failed, returning raw:', e);
      }
    }

    // Step 3: return raw if no prolog or prolog failed
    return data;
  }
}
