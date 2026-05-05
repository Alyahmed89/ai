import { Injectable } from '@nestjs/common';
import { runFlow, createFlowRun } from '../execution/engine';

@Injectable()
export class FlowsService {
  async start(id: string, inputVariables?: Record<string, any>) {
    const flowRun = await createFlowRun(id, inputVariables);
    // Run flow asynchronously — don't await it so the response returns immediately
    runFlow(flowRun).catch(err => console.error('Flow execution error:', err));
    return { flowRunId: flowRun };
  }
}
