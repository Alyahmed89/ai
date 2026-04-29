import { Controller, Post, Body } from '@nestjs/common';
import { FlowsController } from '../flows/flows.controller';
import { FlowRunsController } from '../flow-runs/flow-runs.controller';

@Controller()
export class ActionsController {
  constructor(
    private flowsController: FlowsController,
    private flowRunsController: FlowRunsController
  ) {}

  @Post('start')
  async start(@Body() body: { flowId: string }) {
    const res: any = await this.flowsController.start(body.flowId);
    return { flowRunId: res.flowRunId || res.id };
  }

  @Post('resume')
  async resume(@Body() body: { flowRunId: string; user_input?: any }) {
    const res: any = await this.flowRunsController.resume(body.flowRunId);
    return { flowRunId: res.flowRunId || body.flowRunId };
  }
}
