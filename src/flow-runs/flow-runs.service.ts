import { Injectable } from '@nestjs/common';
import { runFlow } from '../execution/engine';

@Injectable()
export class FlowRunsService {
  async resume(id: string, userInput?: any) {
    await runFlow(id);
    return { status: 'resumed' };
  }
}
