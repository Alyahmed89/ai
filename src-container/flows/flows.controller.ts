import { Controller, Post, Param, Body } from '@nestjs/common';
import { FlowsService } from './flows.service';

@Controller('flows')
export class FlowsController {
  constructor(private flowsService: FlowsService) {}

  @Post(':id/start')
  async start(@Param('id') id: string, @Body() body?: { input_variables?: Record<string, any> }) {
    return this.flowsService.start(id, undefined, body?.input_variables);
  }
}
