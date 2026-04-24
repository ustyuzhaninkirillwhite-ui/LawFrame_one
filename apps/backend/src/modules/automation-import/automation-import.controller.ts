import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  type ActivepiecesImportCandidate,
  AutomationImportService,
} from './automation-import.service';

@Controller('automation-import')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AutomationImportController {
  constructor(
    private readonly automationImportService: AutomationImportService,
  ) {}

  @Post('activepieces/plan')
  @HttpCode(200)
  @RequiredPermissions('automation.publish')
  planActivepiecesImport(@Body() body: ActivepiecesImportCandidate) {
    return this.automationImportService.buildActivepiecesImportPlan(body);
  }
}
