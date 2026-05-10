import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getSupabase } from '../supabase';
import { getFlowRun } from '../execution/engine';

@Injectable()
export class FlowRunsService {
  async resume(id: string, userInput?: string) {
    const flowRun = await getFlowRun(id);
    if (!flowRun) throw new Error(`Flow run ${id} not found`);

    if (flowRun.status === 'paused') {
      // Inject user input as step_goal
      if (userInput != null) {
        await getSupabase().from('variables').insert({
          id: randomUUID(),
          flow_run_id: id,
          step_run_id: null,
          key: 'step_goal',
          value: userInput,
          scope: 'flow_run',
          created_at: new Date().toISOString(),
        }).maybeSingle();
      }
      // Restart the engine — runFlow reads the paused status and resumes from paused_at_step_id
      const { runFlow } = await import('../execution/engine');
      runFlow(id).catch(err => console.error('Flow execution error:', err));
      return { status: 'resumed', flow_run_id: id };
    }

    if (flowRun.status === 'running' && userInput != null) {
      // Flow is running — pause it and store the user's message
      const { data: latestStepRun } = await getSupabase()
        .from('step_runs')
        .select('step_id')
        .eq('flow_run_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await getSupabase()
        .from('flow_runs')
        .update({
          status: 'paused',
          paused_at_step_id: latestStepRun?.step_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      await getSupabase().from('variables').insert({
        id: randomUUID(),
        flow_run_id: id,
        step_run_id: null,
        key: 'step_goal',
        value: userInput,
        scope: 'flow_run',
        created_at: new Date().toISOString(),
      }).maybeSingle();

      return { status: 'paused', flow_run_id: id };
    }

    // Fresh start — run the engine
    const { runFlow } = await import('../execution/engine');
    await runFlow(id, userInput ? { user_input: userInput } : undefined);
    return { status: 'resumed', flow_run_id: id };
  }
}
