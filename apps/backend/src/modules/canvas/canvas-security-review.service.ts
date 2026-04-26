import type {
  CanvasPolicyOverrideDecisionRequest,
  CanvasPolicyOverrideRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasAuditService } from './canvas-audit.service';

@Injectable()
export class CanvasSecurityReviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: CanvasAuditService,
  ) {}

  async requestOverride(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasPolicyOverrideRequest;
  }) {
    requireAnyPermission(input.access, [
      'canvas.policy_override',
      'canvas.security_review',
    ]);
    const workspaceId = requireWorkspaceId(input.access);
    const result = await this.databaseService.query<{
      readonly id: string;
      readonly status: string;
      readonly created_at: string;
    }>(
      `
        insert into app.canvas_policy_override_requests (
          workspace_id,
          automation_id,
          violation_id,
          policy_code,
          requested_action,
          reason,
          requested_by,
          expires_at
        )
        values ($1, $2, $3::uuid, $4, $5, $6, $7, $8::timestamptz)
        returning id, status, created_at
      `,
      [
        workspaceId,
        input.automationId,
        input.request.violation_id ?? null,
        input.request.policy_code,
        input.request.requested_action,
        input.request.reason,
        input.actor.id,
        input.request.expires_at ?? null,
      ],
    );
    const row = result.rows[0];
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      action: 'canvas.policy.override_requested',
      result: 'success',
      reasonCode: input.request.policy_code,
      metadata: {
        overrideRequestId: row?.id ?? null,
        policyCode: input.request.policy_code,
        requestedAction: input.request.requested_action,
      },
    });
    return {
      id: row?.id ?? null,
      status: row?.status ?? 'pending',
      created_at: row?.created_at ?? null,
    };
  }

  async approveOverride(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasPolicyOverrideDecisionRequest;
  }) {
    return this.decideOverride({ ...input, status: 'approved' });
  }

  async rejectOverride(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasPolicyOverrideDecisionRequest;
  }) {
    return this.decideOverride({ ...input, status: 'rejected' });
  }

  private async decideOverride(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasPolicyOverrideDecisionRequest;
    readonly status: 'approved' | 'rejected';
  }) {
    requireAnyPermission(input.access, ['canvas.security_review']);
    const workspaceId = requireWorkspaceId(input.access);
    const result = await this.databaseService.query<{
      readonly id: string;
      readonly status: string;
      readonly policy_code: string;
    }>(
      `
        update app.canvas_policy_override_requests
        set status = $4,
            decided_by = $5,
            decision_reason = $6,
            decided_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and automation_id = $3
          and status = 'pending'
        returning id, status, policy_code
      `,
      [
        input.request.override_request_id,
        workspaceId,
        input.automationId,
        input.status,
        input.actor.id,
        input.request.reason,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'CANVAS_POLICY_OVERRIDE_NOT_FOUND',
        404,
        'Canvas policy override request was not found.',
      );
    }
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      action:
        input.status === 'approved'
          ? 'canvas.policy.override_approved'
          : 'canvas.policy.override_rejected',
      result: 'success',
      reasonCode: row.policy_code,
      metadata: {
        overrideRequestId: row.id,
        policyCode: row.policy_code,
        status: row.status,
      },
    });
    return {
      id: row.id,
      status: row.status,
      policy_code: row.policy_code,
    };
  }
}

function requireAnyPermission(
  access: AccessContext,
  permissions: readonly string[],
) {
  if (
    permissions.some((permission) =>
      access.permissions.includes(permission as never),
    )
  ) {
    return;
  }
  throw new AppHttpException(
    'PERMISSION_DENIED',
    403,
    `${permissions.join(' or ')} permission is required for Canvas security review.`,
  );
}
