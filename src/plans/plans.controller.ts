import { Controller, Post, Param } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Post(':id/tasks')
  async createTasksFromPlan(@Param('id') id: string) {
    return this.plansService.createTasksFromPlan(id);
  }
}
