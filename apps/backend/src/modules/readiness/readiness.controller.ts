import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ReadinessService } from './readiness.service';

@Controller('health')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('readiness')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getReadiness() {
    return this.readinessService.getReadinessSummary();
  }

  @Get('readiness/details')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getReadinessDetails() {
    return this.readinessService.getReadinessDetails();
  }
}
