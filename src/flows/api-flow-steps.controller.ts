import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseFetch(path: string, options: { method?: string; body?: any; params?: Record<string, string> } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
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
  async create(@Body() body: { flow_id: string; title: string; ref?: string; system_message?: string; instructions: string; expected_response: any; order_index?: number }) {
    if (!body.flow_id) {
      throw new Error('flow_id is required');
    }
    const record = {
      id: crypto.randomUUID(),
      flow_id: body.flow_id,
      title: body.title,
      ref: body.ref || crypto.randomUUID(),
      system_message: body.system_message || null,
      instructions: body.instructions,
      expected_response: body.expected_response,
      order_index: body.order_index ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const data = await supabaseFetch('steps', { method: 'POST', body: record, params: { select: '*' } });
    console.log('INSERT DATA:', data);
    return data;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { title?: string; ref?: string; system_message?: string; instructions?: string; expected_response?: any; order_index?: number }) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.ref !== undefined) updates.ref = body.ref;
    if (body.system_message !== undefined) updates.system_message = body.system_message;
    if (body.instructions !== undefined) updates.instructions = body.instructions;
    if (body.expected_response !== undefined) updates.expected_response = body.expected_response;
    if (body.order_index !== undefined) updates.order_index = body.order_index;
    const data = await supabaseFetch(`steps?id=eq.${id}`, { method: 'PATCH', body: updates, params: { select: '*' } });
    return Array.isArray(data) ? data[0] : data;
  }
}
