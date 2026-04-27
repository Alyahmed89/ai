import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlowsController } from './flows/flows.controller';
import { FlowRunsController } from './flow-runs/flow-runs.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [FlowsController, FlowRunsController, HealthController],
  providers: [],
})
export class AppModule {}
