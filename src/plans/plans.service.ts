import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabase } from '../supabase';

@Injectable()
export class PlansService {
  async createTasksFromPlan(planId: string) {
    const supabase = getSupabase();

    const { data: plan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error || !plan) {
      throw new NotFoundException('Plan not found');
    }

    const tasks = plan.metadata?.tasks || [];

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { plan_id: planId, tasks_created: 0 };
    }

    const rows = tasks.map((t: any) => ({
      plan_id: planId,
      type: t.type,
      payload: t.payload || {},
      priority: t.priority ?? 0,
      depends_on: t.depends_on || [],
      status: 'pending',
    }));

    const { error: insertError } = await supabase
      .from('tasks')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    return {
      plan_id: planId,
      tasks_created: rows.length,
    };
  }
}
