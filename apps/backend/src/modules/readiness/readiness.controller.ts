import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ReadinessService } from './readiness.service';

@Controller()
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('health/readiness')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getReadiness() {
    return this.readinessService.getReadinessSummary();
  }

  @Get('health/readiness/details')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getReadinessDetails() {
    return this.readinessService.getReadinessDetails();
  }

  @Get('readiness/stage17')
  async getStage17Readiness(
    @Res({ passthrough: true }) reply: { status: (code: number) => void },
  ) {
    const result = await this.readinessService.getStage17Readiness();
    reply.status(result.overall === 'NOT_READY' ? 503 : 200);
    return result;
  }

  @Get('readiness/stage18')
  getStage18Readiness(
    @Res({ passthrough: true }) reply: { status: (code: number) => void },
  ) {
    const result = this.readinessService.getStage18Readiness();
    reply.status(result.status === 'unavailable' ? 503 : 200);
    return result;
  }

  @Get('readiness/stage19')
  getStage19Readiness(
    @Res({ passthrough: true }) reply: { status: (code: number) => void },
  ) {
    const result = this.readinessService.getStage19Readiness();
    reply.status(result.status === 'unavailable' ? 503 : 200);
    return result;
  }

  @Get('readiness/stage20')
  getStage20Readiness(
    @Res({ passthrough: true }) reply: { status: (code: number) => void },
  ) {
    const result = this.readinessService.getStage20Readiness();
    reply.status(result.status === 'unavailable' ? 503 : 200);
    return result;
  }
}
