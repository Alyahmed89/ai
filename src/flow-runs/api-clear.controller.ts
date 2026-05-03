import { Controller, Delete } from '@nestjs/common';
import { getSupabase } from '../supabase';

@Controller('api/clear')
export class ApiClearController {
  @Delete()
  async clearAll() {
    // Delete in dependency order (child tables first)
    await getSupabase().from('refs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('api_calls').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('step_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('step_conditions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('steps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('flow_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('variables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('endpoint_registry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await getSupabase().from('flows').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return { success: true };
  }
}
