import type {
  SecurityIncident,
  SecurityIncidentUpdateRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SecurityOperationsService } from './security-operations.service';

@Controller('admin/security')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class SecurityOperationsController {
  constructor(
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

  @Get('alerts')
  @RequiredPermissions('incident.read')
  listAlerts(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.securityOperationsService.listAlerts(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Patch('alerts/:alertId')
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('incident.manage')
  updateAlert(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('alertId') alertId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.securityOperationsService.updateAlert(
      context.actor,
      context.access,
      alertId,
      parseAlertStatus(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Get('incidents')
  @RequiredPermissions('incident.read')
  listIncidents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.securityOperationsService.listIncidents(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Post('incidents')
  @HttpCode(200)
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('incident.manage')
  createIncident(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const parsed = parseIncidentCreate(body);
    return this.securityOperationsService.createIncident(
      context.actor,
      context.access,
      parsed.title,
      parsed.severity,
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Patch('incidents/:incidentId')
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('incident.manage')
  updateIncident(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('incidentId') incidentId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.securityOperationsService.updateIncident(
      context.actor,
      context.access,
      incidentId,
      parseIncidentPatch(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }
}

function parseAlertStatus(body: unknown): 'acknowledged' | 'resolved' {
  const status =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { status?: unknown }).status === 'string'
      ? (body as { status?: string }).status
      : null;

  return status === 'resolved' ? 'resolved' : 'acknowledged';
}

function parseIncidentCreate(body: unknown): {
  readonly title: string;
  readonly severity: SecurityIncident['severity'];
} {
  const value =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  return {
    title:
      typeof value.title === 'string' && value.title.trim().length > 0
        ? value.title.trim()
        : 'Security incident',
    severity:
      value.severity === 'critical' ||
      value.severity === 'high' ||
      value.severity === 'medium'
        ? value.severity
        : ('low' as const),
  };
}

function parseIncidentPatch(body: unknown): SecurityIncidentUpdateRequest {
  const value =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  return {
    ...(value.status === 'open' ||
    value.status === 'contained' ||
    value.status === 'resolved' ||
    value.status === 'closed'
      ? { status: value.status }
      : {}),
    ...(typeof value.incidentModeEnabled === 'boolean'
      ? { incidentModeEnabled: value.incidentModeEnabled }
      : {}),
    ...(typeof value.assignedTo === 'string'
      ? { assignedTo: value.assignedTo.trim() || null }
      : value.assignedTo === null
        ? { assignedTo: null }
        : {}),
  };
}
