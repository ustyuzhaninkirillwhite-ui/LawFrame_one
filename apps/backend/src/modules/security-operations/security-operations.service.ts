import type { SecurityAlert, SecurityIncident } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

interface SecurityAlertRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly rule_code: string | null;
  readonly severity: SecurityAlert['severity'];
  readonly status: SecurityAlert['status'];
  readonly title: string;
  readonly description: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly created_at: string;
  readonly acknowledged_at: string | null;
  readonly resolved_at: string | null;
}

interface SecurityIncidentRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly title: string;
  readonly severity: SecurityIncident['severity'];
  readonly status: SecurityIncident['status'];
  readonly incident_mode_enabled: boolean;
  readonly assigned_to: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class SecurityOperationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listAlerts(
    workspaceId: string | null,
  ): Promise<readonly SecurityAlert[]> {
    const result = await this.databaseService.query<SecurityAlertRow>(
      `
        select
          a.id,
          a.workspace_id,
          r.rule_code,
          a.severity,
          a.status,
          a.title,
          a.description,
          a.entity_type,
          a.entity_id,
          a.created_at,
          a.acknowledged_at,
          a.resolved_at
        from app.security_alerts a
        left join app.security_alert_rules r
          on r.id = a.rule_id
        where ($1::uuid is null or a.workspace_id = $1)
        order by a.created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      ruleCode: row.rule_code ?? 'manual',
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    }));
  }

  async updateAlert(
    actor: AuthenticatedActor,
    access: AccessContext,
    alertId: string,
    status: 'acknowledged' | 'resolved',
    requestId: string | null,
    traceId: string | null,
  ): Promise<SecurityAlert> {
    const row = await this.databaseService.one<SecurityAlertRow>(
      `
        update app.security_alerts
        set
          status = $2,
          acknowledged_at = case when $2 = 'acknowledged' then timezone('utc', now()) else acknowledged_at end,
          resolved_at = case when $2 = 'resolved' then timezone('utc', now()) else resolved_at end
        where id = $1
          and ($3::uuid is null or workspace_id = $3)
        returning
          id,
          workspace_id,
          null::text as rule_code,
          severity,
          status,
          title,
          description,
          entity_type,
          entity_id,
          created_at,
          acknowledged_at,
          resolved_at
      `,
      [alertId, status, access.activeWorkspace?.id ?? null],
    );

    if (!row) {
      throw new AppHttpException(
        'SECURITY_ALERT_NOT_FOUND',
        404,
        'Security alert was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'incident.alert_status_changed',
      entityType: 'security_alert',
      entityId: alertId,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'incident',
      sessionId: actor.sessionId,
      metadata: { status },
    });

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      ruleCode: row.rule_code ?? 'manual',
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    };
  }

  async listIncidents(
    workspaceId: string | null,
  ): Promise<readonly SecurityIncident[]> {
    const result = await this.databaseService.query<SecurityIncidentRow>(
      `
        select
          id,
          workspace_id,
          title,
          severity,
          status,
          incident_mode_enabled,
          assigned_to,
          created_at,
          updated_at
        from app.security_incidents
        where ($1::uuid is null or workspace_id = $1)
        order by created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => this.mapIncident(row));
  }

  async createIncident(
    actor: AuthenticatedActor,
    access: AccessContext,
    title: string,
    severity: SecurityIncident['severity'],
    requestId: string | null,
    traceId: string | null,
  ): Promise<SecurityIncident> {
    const row = await this.databaseService.one<SecurityIncidentRow>(
      `
        insert into app.security_incidents (
          workspace_id,
          title,
          severity,
          status,
          incident_mode_enabled,
          created_by,
          assigned_to
        )
        values ($1, $2, $3, 'open', false, $4, $4)
        returning
          id,
          workspace_id,
          title,
          severity,
          status,
          incident_mode_enabled,
          assigned_to,
          created_at,
          updated_at
      `,
      [access.activeWorkspace?.id ?? null, title, severity, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Security incident could not be created.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'incident.created',
      entityType: 'security_incident',
      entityId: row.id,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'incident',
      sessionId: actor.sessionId,
      metadata: { severity },
    });

    return this.mapIncident(row);
  }

  async updateIncident(
    actor: AuthenticatedActor,
    access: AccessContext,
    incidentId: string,
    patch: {
      readonly status?: SecurityIncident['status'];
      readonly incidentModeEnabled?: boolean;
      readonly assignedTo?: string | null;
    },
    requestId: string | null,
    traceId: string | null,
  ): Promise<SecurityIncident> {
    const current = await this.databaseService.one<SecurityIncidentRow>(
      `
        select
          id,
          workspace_id,
          title,
          severity,
          status,
          incident_mode_enabled,
          assigned_to,
          created_at,
          updated_at
        from app.security_incidents
        where id = $1
          and ($2::uuid is null or workspace_id = $2)
        limit 1
      `,
      [incidentId, access.activeWorkspace?.id ?? null],
    );

    if (!current) {
      throw new AppHttpException(
        'INCIDENT_NOT_FOUND',
        404,
        'Security incident was not found.',
      );
    }

    const row = await this.databaseService.one<SecurityIncidentRow>(
      `
        update app.security_incidents
        set
          status = $3,
          incident_mode_enabled = $4,
          assigned_to = $5,
          updated_at = timezone('utc', now())
        where id = $1
          and ($2::uuid is null or workspace_id = $2)
        returning
          id,
          workspace_id,
          title,
          severity,
          status,
          incident_mode_enabled,
          assigned_to,
          created_at,
          updated_at
      `,
      [
        incidentId,
        access.activeWorkspace?.id ?? null,
        patch.status ?? current.status,
        patch.incidentModeEnabled ?? current.incident_mode_enabled,
        patch.assignedTo === undefined ? current.assigned_to : patch.assignedTo,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'INCIDENT_NOT_FOUND',
        404,
        'Security incident was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'incident.status_changed',
      entityType: 'security_incident',
      entityId: incidentId,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'incident',
      sessionId: actor.sessionId,
      metadata: patch,
    });

    return this.mapIncident(row);
  }

  private mapIncident(row: SecurityIncidentRow): SecurityIncident {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      incidentModeEnabled: row.incident_mode_enabled,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
