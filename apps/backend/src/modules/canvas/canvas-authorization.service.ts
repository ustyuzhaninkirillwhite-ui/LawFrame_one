import type {
  CanvasAccessDecision,
  CanvasAccessDecisionReasonCode,
  CanvasOperation,
  CanvasRiskLevel,
  CanvasSecurityCheckRequest,
  CanvasSecurityContext,
} from '@lexframe/contracts';
import type { PermissionCode } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasAuditService } from './canvas-audit.service';
import { CanvasDraftService } from './canvas-draft.service';
import {
  CANVAS_ENDPOINT_POLICY_MAP,
  CANVAS_OPERATION_POLICY_MAP,
  type CanvasEndpointPolicyKey,
  type CanvasOperationPolicy,
} from './canvas-security-policy-map';
import { CanvasSecurityPolicyService } from './canvas-security-policy.service';

interface OwnershipRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly workflow_state: string | null;
  readonly active_canvas_version_id: string | null;
}

@Injectable()
export class CanvasAuthorizationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly policyService: CanvasSecurityPolicyService,
    private readonly auditService: CanvasAuditService,
  ) {}

  async buildContext(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
  }): Promise<CanvasSecurityContext> {
    const workspaceId = requireWorkspaceId(input.access);
    await this.assertAutomationOwnership(input.access, input.automationId);
    const policies = await this.policyService.listPolicies(
      input.access,
      input.automationId,
    );
    const capabilities = this.draftService.buildPermissions(input.access);
    const decisions: Record<string, CanvasAccessDecision> = {};
    for (const key of [
      'compile-preview',
      'compile',
      'sync-runtime',
      'publish',
      'runtime-pull',
      'runtime-import-preview',
      'runtime-import-apply',
      'runtime-overwrite',
      'audit-read',
      'audit-export',
    ] satisfies CanvasEndpointPolicyKey[]) {
      decisions[key] = await this.authorizeEndpoint({
        actor: input.actor,
        access: input.access,
        automationId: input.automationId,
        endpoint: key,
        skipOwnershipCheck: true,
      });
    }
    return {
      workspace_id: workspaceId,
      automation_id: input.automationId,
      actor_id: input.actor.id,
      roles: input.access.roles,
      permissions: input.access.permissions,
      capabilities,
      default_visibility: input.access.permissions.includes(
        'canvas.test.view_redacted',
      )
        ? 'structured_safe'
        : 'metadata_only',
      session_assurance: input.actor.assuranceLevel,
      policies,
      decisions,
    };
  }

  async authorizeOperation(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly operation: CanvasOperation;
    readonly reauthenticated?: boolean;
    readonly skipOwnershipCheck?: boolean;
  }): Promise<CanvasAccessDecision> {
    const policy =
      CANVAS_OPERATION_POLICY_MAP[input.operation.operation_type] ??
      unknownPolicy(input.operation.operation_type);
    const findings = this.policyService.evaluateOperationPayload(
      input.operation,
    );
    if (findings.length > 0) {
      const highest = highestRisk(findings.map((finding) => finding.severity));
      const allOverrideable = findings.every(
        (finding) => finding.overrideAllowed,
      );
      const hasOverride = input.access.permissions.includes(
        'canvas.policy_override',
      );
      if (!allOverrideable || !hasOverride) {
        return this.decision({
          allowed: false,
          reasonCode: allOverrideable
            ? 'POLICY_OVERRIDE_REQUIRED'
            : 'POLICY_BLOCKED',
          policy: { ...policy, riskLevel: highest },
          missingPermissions: [],
          policyCodes: findings.map((finding) => finding.code),
          requiredAction: allOverrideable
            ? 'request_policy_override'
            : 'security_review',
        });
      }
    }
    return this.authorizePolicy({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      policy,
      reauthenticated: input.reauthenticated,
      skipOwnershipCheck: input.skipOwnershipCheck,
    });
  }

  async authorizeEndpoint(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly endpoint: CanvasEndpointPolicyKey;
    readonly reauthenticated?: boolean;
    readonly skipOwnershipCheck?: boolean;
  }): Promise<CanvasAccessDecision> {
    return this.authorizePolicy({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      policy: CANVAS_ENDPOINT_POLICY_MAP[input.endpoint],
      reauthenticated: input.reauthenticated,
      skipOwnershipCheck: input.skipOwnershipCheck,
    });
  }

  async checkAction(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasSecurityCheckRequest;
  }): Promise<CanvasAccessDecision> {
    if (input.request.operation_type) {
      return this.authorizeOperation({
        actor: input.actor,
        access: input.access,
        automationId: input.automationId,
        operation: {
          client_operation_id: 'security-check',
          operation_type: input.request.operation_type,
          operation_payload: input.request.payload ?? {},
        },
      });
    }
    const endpoint = endpointFromAction(input.request.action);
    if (endpoint) {
      return this.authorizeEndpoint({
        actor: input.actor,
        access: input.access,
        automationId: input.automationId,
        endpoint,
      });
    }
    return this.decision({
      allowed: false,
      reasonCode: 'UNKNOWN_OPERATION',
      policy: unknownPolicy(input.request.action),
      missingPermissions: [],
      policyCodes: [],
      requiredAction: 'none',
    });
  }

  async assertAllowed(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly decision: CanvasAccessDecision;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditService.recordDecision({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      decision: input.decision,
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
      metadata: input.metadata,
    });
    if (!input.decision.allowed) {
      await this.policyService.recordViolation({
        actor: input.actor,
        access: input.access,
        automationId: input.automationId,
        decision: input.decision,
        safeEvidence: {
          requestId: input.requestId ?? null,
          traceId: input.traceId ?? null,
        },
      });
      throw new AppHttpException(
        canvasErrorCode(input.decision.reason_code),
        input.decision.reason_code === 'REAUTH_REQUIRED' ? 401 : 403,
        input.decision.message ?? 'Canvas action is not allowed.',
        { decision: input.decision },
      );
    }
  }

  private async authorizePolicy(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly policy: CanvasOperationPolicy;
    readonly reauthenticated?: boolean;
    readonly skipOwnershipCheck?: boolean;
  }): Promise<CanvasAccessDecision> {
    const workspaceId = input.access.activeWorkspace?.id;
    if (!workspaceId) {
      return this.decision({
        allowed: false,
        reasonCode: 'WORKSPACE_REQUIRED',
        policy: input.policy,
        missingPermissions: [],
        policyCodes: [],
        requiredAction: 'none',
      });
    }
    if (!input.skipOwnershipCheck) {
      const ownership = await this.assertAutomationOwnership(
        input.access,
        input.automationId,
      );
      if (ownership.workspace_id !== workspaceId) {
        return this.decision({
          allowed: false,
          reasonCode: 'OBJECT_WORKSPACE_MISMATCH',
          policy: input.policy,
          missingPermissions: [],
          policyCodes: [],
          requiredAction: 'none',
        });
      }
    }

    const missingPermissions = input.policy.requiredPermissions.filter(
      (permission) => !input.access.permissions.includes(permission),
    );
    if (missingPermissions.length > 0) {
      return this.decision({
        allowed: false,
        reasonCode: 'PERMISSION_DENIED',
        policy: input.policy,
        missingPermissions,
        policyCodes: [],
        requiredAction: 'none',
      });
    }
    if (
      input.policy.reauthRequired === true &&
      input.actor.assuranceLevel !== 'aal2' &&
      input.reauthenticated !== true
    ) {
      return this.decision({
        allowed: false,
        reasonCode: 'REAUTH_REQUIRED',
        policy: input.policy,
        missingPermissions: [],
        policyCodes: [],
        requiredAction: 'reauth',
      });
    }
    return this.decision({
      allowed: true,
      reasonCode: 'ALLOWED',
      policy: input.policy,
      missingPermissions: [],
      policyCodes: [],
      requiredAction: 'none',
    });
  }

  private async assertAutomationOwnership(
    access: AccessContext,
    automationId: string,
  ): Promise<OwnershipRow> {
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<OwnershipRow>(
      `
        select id, workspace_id, workflow_state, active_canvas_version_id
        from app.installed_automations
        where id = $1
          and workspace_id = $2
          and deleted_at is null
        limit 1
      `,
      [automationId, workspaceId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'CANVAS_AUTOMATION_NOT_FOUND',
        404,
        'Canvas automation was not found in the active workspace.',
      );
    }
    return row;
  }

  private decision(input: {
    readonly allowed: boolean;
    readonly reasonCode: CanvasAccessDecisionReasonCode;
    readonly policy: CanvasOperationPolicy;
    readonly missingPermissions: readonly PermissionCode[];
    readonly policyCodes: readonly string[];
    readonly requiredAction: CanvasAccessDecision['required_action'];
  }): CanvasAccessDecision {
    return {
      allowed: input.allowed,
      reason_code: input.reasonCode,
      message: messageForReason(input.reasonCode),
      required_permissions: input.policy.requiredPermissions,
      matched_permissions: input.policy.requiredPermissions.filter(
        (permission) => !input.missingPermissions.includes(permission),
      ),
      missing_permissions: input.missingPermissions,
      risk_level: input.policy.riskLevel,
      redaction_mode: input.policy.redactionMode,
      required_action: input.requiredAction,
      policy_codes: input.policyCodes,
      audit_event: input.policy.auditEvent,
      resource: input.policy.resource,
      action: input.policy.action,
    };
  }
}

function unknownPolicy(action: string): CanvasOperationPolicy {
  return {
    action,
    resource: 'automation',
    requiredPermissions: ['canvas.security_review'],
    riskLevel: 'critical',
    redactionMode: 'metadata_only',
    auditEvent: 'canvas.security.unknown_action',
    reauthRequired: true,
  };
}

function endpointFromAction(action: string): CanvasEndpointPolicyKey | null {
  const entries = Object.entries(CANVAS_ENDPOINT_POLICY_MAP) as [
    CanvasEndpointPolicyKey,
    CanvasOperationPolicy,
  ][];
  return entries.find(([, policy]) => policy.action === action)?.[0] ?? null;
}

function highestRisk(levels: readonly CanvasRiskLevel[]): CanvasRiskLevel {
  const order: Record<CanvasRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return levels.reduce<CanvasRiskLevel>(
    (highest, current) => (order[current] > order[highest] ? current : highest),
    'low',
  );
}

function messageForReason(reason: CanvasAccessDecisionReasonCode) {
  switch (reason) {
    case 'ALLOWED':
      return 'Canvas action is allowed.';
    case 'PERMISSION_DENIED':
      return 'Required Canvas permission is missing.';
    case 'REAUTH_REQUIRED':
      return 'Recent reauthentication is required for this Canvas action.';
    case 'POLICY_BLOCKED':
      return 'Canvas security policy blocks this action.';
    case 'POLICY_OVERRIDE_REQUIRED':
      return 'Canvas policy override is required before this action.';
    case 'OBJECT_WORKSPACE_MISMATCH':
      return 'Canvas object belongs to a different workspace.';
    case 'WORKSPACE_REQUIRED':
      return 'Workspace context is required.';
    default:
      return 'Canvas action is not allowed.';
  }
}

function canvasErrorCode(reason: CanvasAccessDecisionReasonCode) {
  switch (reason) {
    case 'REAUTH_REQUIRED':
      return 'CANVAS_REAUTH_REQUIRED';
    case 'POLICY_BLOCKED':
      return 'CANVAS_POLICY_BLOCKED';
    case 'POLICY_OVERRIDE_REQUIRED':
      return 'CANVAS_POLICY_OVERRIDE_REQUIRED';
    case 'PERMISSION_DENIED':
      return 'CANVAS_PERMISSION_DENIED';
    default:
      return 'CANVAS_ACTION_DENIED';
  }
}
