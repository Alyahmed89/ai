import { Controller, Post, Body } from '@nestjs/common';
import { FlowsService } from '../flows/flows.service';
import { FlowRunsService } from '../flow-runs/flow-runs.service';

@Controller()
export class ActionsController {
  constructor(
    private flowsService: FlowsService,
    private flowRunsService: FlowRunsService
  ) {}

  @Post('start')
  async start(@Body() body: { flowId: string; input_variables?: Record<string, any> }) {
    const res = await this.flowsService.start(body.flowId, body.input_variables);
    return { flowRunId: res.flowRunId };
  }

  @Post('resume')
  async resume(@Body() body: { flowRunId: string; user_input?: any }) {
    await this.flowRunsService.resume(body.flowRunId, body.user_input);
    return { flowRunId: body.flowRunId };
  }
}
