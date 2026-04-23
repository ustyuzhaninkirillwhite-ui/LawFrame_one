import { Controller, Get, Header } from '@nestjs/common';
import { RuntimeHealthService } from './runtime-health.service';

@Controller()
export class OpsController {
  constructor(private readonly runtimeHealthService: RuntimeHealthService) {}

  @Get('health/live')
  getLive() {
    return this.runtimeHealthService.getLiveSummary();
  }

  @Get('health/ready')
  getReady() {
    return this.runtimeHealthService.getReadySummary();
  }

  @Get('health/dependencies')
  async getDependencies() {
    const dependencies = await this.runtimeHealthService.getDependencies();
    return {
      checkedAt: new Date().toISOString(),
      dependencies,
    };
  }

  @Get('system/status')
  getSystemStatus() {
    return this.runtimeHealthService.getSystemStatus();
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics() {
    return this.runtimeHealthService.renderMetrics();
  }
}
