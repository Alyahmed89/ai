import { Controller, Post, Param } from '@nestjs/common';
import { FlowsService } from './flows.service';

@Controller('flows')
export class FlowsController {
  constructor(private flowsService: FlowsService) {}

  @Post(':id/start')
  async start(@Param('id') id: string) {
    return this.flowsService.start(id);
  }
}
