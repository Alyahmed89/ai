import { Controller, Post, Body, Param } from '@nestjs/common';
import { FlowsService } from '../flows/flows.service';
import { FlowRunsService } from '../flow-runs/flow-runs.service';

@Controller()
export class ActionsController {
  constructor(
    private flowsService: FlowsService,
    private flowRunsService: FlowRunsService,
  ) {}

  @Post('start')
  async start(@Body() body: { flowId: string; name?: string; input?: Record<string, any> }) {
    return this.flowsService.start(body.flowId, body.name, body.input);
  }

  @Post('resume')
  async resume(@Body() body: { flowRunId: string; user_input?: Record<string, any> }) {
    return this.flowRunsService.resume(body.flowRunId, body.user_input);
  }
}
