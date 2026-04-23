import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ReadinessService } from './readiness.service';

@Controller('health')
@UseGuards(AuthGuard, WorkspaceContextGuard)
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('readiness')
  getReadiness() {
    return this.readinessService.getReadinessSummary();
  }

  @Get('readiness/details')
  getReadinessDetails() {
    return this.readinessService.getReadinessDetails();
  }
}
