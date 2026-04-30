import { Injectable } from '@nestjs/common';
import { runFlow, createFlowRun } from '../execution/engine';

@Injectable()
export class FlowsService {
  async start(id: string) {
    const flowRun = await createFlowRun(id);
    // Run flow asynchronously — don't await it so the response returns immediately
    runFlow(flowRun).catch(err => console.error('Flow execution error:', err));
    return { flowRunId: flowRun };
  }
}
