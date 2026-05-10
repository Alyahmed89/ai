import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getSupabase } from '../supabase';
import { getFlowRun } from '../execution/engine';

@Injectable()
export class FlowRunsService {
  async resume(id: string, userInput?: Record<string, any>) {
    const flowRun = await getFlowRun(id);
    if (!flowRun) throw new Error(`Flow run ${id} not found`);

    if (flowRun.status === 'paused') {
      // Same logic as /interrupt's resume branch: inject step_goal, set running
      if (userInput != null) {
        const value = typeof userInput === 'object' && !Array.isArray(userInput)
          ? String(Object.values(userInput)[0] ?? userInput)
          : String(userInput);
        await getSupabase().from('variables').insert({
          id: randomUUID(),
          flow_run_id: id,
          step_run_id: null,
          key: 'step_goal',
          value,
          scope: 'flow_run',
          created_at: new Date().toISOString(),
        }).maybeSingle();
      }
      await getSupabase()
        .from('flow_runs')
        .update({ status: 'running', paused_at_step_id: null, updated_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      // Fresh start — run the engine
      const { runFlow } = await import('../execution/engine');
      await runFlow(id, userInput);
    }

    return { status: 'resumed' };
  }
}
