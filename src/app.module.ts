import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlowsController } from './flows/flows.controller';
import { FlowRunsController } from './flow-runs/flow-runs.controller';
import { HealthController } from './health.controller';
import { ApiFlowsController } from './flows/api-flows.controller';
import { ApiFlowStepsController } from './flows/api-flow-steps.controller';
import { ApiFlowsStepsOrderController } from './flows/api-flows-steps-order.controller';
import { ApiVariablesController } from './flow-runs/api-variables.controller';
import { ApiEndpointsController } from './flow-runs/api-endpoints.controller';
import { ApiConditionsController } from './flow-runs/api-conditions.controller';
import { ApiStepRunsController } from './flow-runs/api-step-runs.controller';
import { ActionsController } from './execution/actions.controller';
import { FlowsService } from './flows/flows.service';
import { FlowRunsService } from './flow-runs/flow-runs.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    FlowsController,
    FlowRunsController,
    HealthController,
    ApiFlowsController,
    ApiFlowStepsController,
    ApiFlowsStepsOrderController,
    ApiVariablesController,
    ApiEndpointsController,
    ApiConditionsController,
    ApiStepRunsController,
    ActionsController,
  ],
  providers: [FlowsService, FlowRunsService],
})
export class AppModule {}
