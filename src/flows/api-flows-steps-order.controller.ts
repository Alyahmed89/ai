import { Controller, Put, Param, Body } from '@nestjs/common';
import { getSupabase } from '../supabase';


@Controller('api/flows')
export class ApiFlowsStepsOrderController {
  @Put(':id/steps')
  async reorder(@Param('id') id: string, @Body() body: { step_ids: string[] }) {
    const updates = body.step_ids.map((stepId, index) => ({
      id: stepId,
      order_index: index,
      updated_at: new Date().toISOString(),
    }));
    for (const u of updates) {
      await getSupabase().from('steps').update({ order_index: u.order_index, updated_at: u.updated_at }).eq('id', u.id);
    }
    return { success: true };
  }
}
