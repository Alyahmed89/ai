import { Injectable } from '@nestjs/common';
import { runFlow } from '../execution/engine';

@Injectable()
export class FlowsService {
  async start(id: string) {
    const flowRunId = Math.random().toString(36).substring(2, 15);
    await runFlow(flowRunId);
    return { flowRunId };
  }
}
