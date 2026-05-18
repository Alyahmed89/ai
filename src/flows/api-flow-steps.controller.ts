import { randomUUID } from 'crypto';
import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseFetch(path: string, options: { method?: string; body?: any; params?: Record<string, string> } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };
  if (options.method === 'POST' || options.method === 'PATCH') {
    headers['Prefer'] = 'return=representation';
  }
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

@Controller('api/flow-steps')
export class ApiFlowStepsController {
  @Get()
  async list(@Query('flow_id') flowId?: string) {
    const params: Record<string, string> = { order: 'order_index.asc' };
    if (flowId) {
      params['flow_id'] = `eq.${flowId}`;
    }
    const data = await supabaseFetch('steps', { params });
    return data || [];
  }

  @Post()
  async create(@Body() body: {
    flow_id: string;
    title: string;
    instructions: string;
    expected_response: any;
    order_index?: number;
    required_inputs?: string[];
    variable_aliases?: Record<string, string[]>;
  }) {
    if (!body.flow_id) {
      throw new Error('flow_id is required');
    }
    const record = {
      id: randomUUID(),
      flow_id: body.flow_id,
      title: body.title,
      instructions: body.instructions,
      expected_response: body.expected_response,
      order_index: body.order_index ?? 0,
      created_at: new Date().toISOString(),
    };
    const data = await supabaseFetch('steps', { method: 'POST', body: record, params: { select: '*' } });
    console.log('INSERT DATA:', data);
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: {
    title?: string;
    ref?: string;
    instructions?: string;
    expected_response?: any;
    order_index?: number;
    required_inputs?: string[];
    variable_aliases?: Record<string, string[]>;
  }) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.ref !== undefined) updates.ref = body.ref;
    if (body.instructions !== undefined) updates.instructions = body.instructions;
    if (body.expected_response !== undefined) updates.expected_response = body.expected_response;
    if (body.order_index !== undefined) updates.order_index = body.order_index;
    if (body.required_inputs !== undefined) updates.required_inputs = body.required_inputs;
    if (body.variable_aliases !== undefined) updates.variable_aliases = body.variable_aliases;
    const data = await supabaseFetch(`steps?id=eq.${id}`, { method: 'PATCH', body: updates, params: { select: '*' } });
    return Array.isArray(data) ? data[0] : data;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await supabaseFetch(`step_conditions?step_id=eq.${id}`, { method: 'DELETE' });
    await supabaseFetch(`step_runs?step_id=eq.${id}`, { method: 'DELETE' });
    await supabaseFetch(`steps?id=eq.${id}`, { method: 'DELETE' });
    return { success: true };
  }
}

@Controller('api/flow-runs')
export class ApiFlowRunsController {}
