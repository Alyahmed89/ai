import { Controller, Post, Param } from '@nestjs/common';
import { runFlow } from '../execution/engine';

@Controller('flows')
export class FlowsController {
  @Post(':id/start')
  async start(@Param('id') id: string) {
    const flowRunId = Math.random().toString(36).substring(2, 15);
    await runFlow(flowRunId);
    return { flowRunId };
  }
}
