import { Injectable } from '@nestjs/common';
import { runFlow, createExecution } from '../execution/engine';

@Injectable()
export class FlowsService {
  async start(flowId: string, name?: string, input?: Record<string, any>) {
    const executionId = await createExecution(flowId, name, input);
    runFlow(executionId).catch(err => console.error('[FlowsService] runFlow error:', err));
    return { flowRunId: executionId };
  }
}
