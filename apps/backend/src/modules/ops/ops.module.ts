import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { OpsController } from './ops.controller';
import { RuntimeHealthService } from './runtime-health.service';

@Module({
  imports: [DatabaseModule, ReadinessModule],
  controllers: [OpsController],
  providers: [RuntimeHealthService],
  exports: [RuntimeHealthService],
})
export class OpsModule {}
