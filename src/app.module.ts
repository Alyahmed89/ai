import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlowsController } from './flows/flows.controller';
import { FlowRunsController } from './flow-runs/flow-runs.controller';
import { HealthController } from './health.controller';
import { ApiFlowsController } from './flows/api-flows.controller';
import { ApiFlowStepsController, ApiFlowRunsController } from './flows/api-flow-steps.controller';
import { ApiFlowsStepsOrderController } from './flows/api-flows-steps-order.controller';
import { ApiVariablesController } from './flow-runs/api-variables.controller';
import { ApiEndpointsController } from './flow-runs/api-endpoints.controller';
import { ApiConditionsController } from './flow-runs/api-conditions.controller';
import { ApiStepRunsController } from './flow-runs/api-step-runs.controller';
import { ContextController } from './flow-runs/context.controller';
import { ApiClearController } from './flow-runs/api-clear.controller';
import { ApiQueryController } from './flow-runs/api-query.controller';
import { ActionsController } from './execution/actions.controller';
import { PlansController } from './plans/plans.controller';
import { FlowsService } from './flows/flows.service';
import { FlowRunsService } from './flow-runs/flow-runs.service';
import { PlansService } from './plans/plans.service';

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
    ApiFlowRunsController,
    ApiFlowsStepsOrderController,
    ApiVariablesController,
    ApiEndpointsController,
    ApiConditionsController,
    ApiStepRunsController,
    ContextController,
    ApiClearController,
    ApiQueryController,
    ActionsController,
    PlansController,
  ],
  providers: [FlowsService, FlowRunsService, PlansService],
})
export class AppModule {}
