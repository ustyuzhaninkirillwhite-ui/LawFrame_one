import type {
  CanvasAccessDecision,
  CanvasOperation,
  CanvasPolicyViolation,
  CanvasRiskLevel,
  CanvasSecurityPolicy,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface CanvasSecurityPolicyRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string | null;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly severity: CanvasRiskLevel;
  readonly enforcement: 'warn' | 'block' | 'review_required';
  readonly enabled: boolean;
  readonly allow_override: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

const SECRET_LITERAL_KEY =
  /token|api[_-]?key|password|private[_-]?key|service[_-]?key|secret[_-]?value/i;
const SECRET_LITERAL_VALUE =
  /(-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----|service_role|sk-[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{12,})/;
const SIGNED_URL_VALUE =
  /(X-Amz-Signature=|X-Goog-Signature=|sig=|signature=)/i;
const UNKNOWN_HTTP_VALUE =
  /^https?:\/\/(?!localhost|127\.0\.0\.1|api\.lexframe\.local|api\.lexframe\.com|hooks\.slack\.com|graph\.microsoft\.com)/i;

const DEFAULT_POLICY_TEMPLATES = [
  {
    code: 'WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL',
    title: 'External delivery requires approval',
    description:
      'External delivery of classified data must pass an approval gate.',
    severity: 'high',
    enforcement: 'block',
    allow_override: false,
  },
  {
    code: 'WF_POLICY_002_AI_ROUTE_FORBIDDEN_FOR_DATA_CLASS',
    title: 'AI route must use AI Gateway',
    description: 'Canvas AI actions cannot bypass LexFrame AI Gateway.',
    severity: 'critical',
    enforcement: 'block',
    allow_override: false,
  },
  {
    code: 'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
    title: 'Secret literal is blocked',
    description:
      'Secrets must be stored as backend references, not Canvas config literals.',
    severity: 'critical',
    enforcement: 'block',
    allow_override: false,
  },
  {
    code: 'WF_POLICY_007_UNKNOWN_HTTP_DOMAIN',
    title: 'Unknown HTTP domain requires review',
    description:
      'HTTP targets must use allowed domains or reviewed connectors.',
    severity: 'high',
    enforcement: 'review_required',
    allow_override: true,
  },
  {
    code: 'WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN',
    title: 'Signed URL is blocked',
    description: 'Signed URLs cannot be persisted in Canvas operations.',
    severity: 'critical',
    enforcement: 'block',
    allow_override: false,
  },
] as const;

@Injectable()
export class CanvasSecurityPolicyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPolicies(
    access: AccessContext,
    automationId: string,
  ): Promise<readonly CanvasSecurityPolicy[]> {
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<CanvasSecurityPolicyRow>(
      `
        select
          id,
          workspace_id,
          automation_id,
          code,
          title,
          description,
          severity,
          enforcement,
          enabled,
          allow_override,
          created_at,
          updated_at
        from app.canvas_security_policies
        where workspace_id = $1
          and (automation_id is null or automation_id = $2)
          and enabled = true
        order by automation_id nulls first, code asc
      `,
      [workspaceId, automationId],
    );
    const persisted = result.rows.map(toPolicy);
    const persistedCodes = new Set(persisted.map((policy) => policy.code));
    return [
      ...persisted,
      ...DEFAULT_POLICY_TEMPLATES.filter(
        (policy) => !persistedCodes.has(policy.code),
      ).map((policy) => ({
        id: `builtin:${policy.code}`,
        workspace_id: workspaceId,
        automation_id: null,
        code: policy.code,
        title: policy.title,
        description: policy.description,
        severity: policy.severity,
        enforcement: policy.enforcement,
        enabled: true,
        allow_override: policy.allow_override,
        created_at: undefined,
        updated_at: undefined,
      })),
    ];
  }

  evaluateOperationPayload(operation: CanvasOperation): readonly {
    readonly code: string;
    readonly severity: CanvasRiskLevel;
    readonly overrideAllowed: boolean;
  }[] {
    const findings: {
      readonly code: string;
      readonly severity: CanvasRiskLevel;
      readonly overrideAllowed: boolean;
    }[] = [];
    scanValue(operation.operation_payload, '$', findings);
    return findings;
  }

  async recordViolation(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId?: string | null;
    readonly operationId?: string | null;
    readonly operationType?: string | null;
    readonly decision: CanvasAccessDecision;
    readonly safeEvidence?: Record<string, unknown>;
  }): Promise<CanvasPolicyViolation | null> {
    if (input.decision.policy_codes.length === 0) {
      return null;
    }
    const workspaceId = requireWorkspaceId(input.access);
    const policyCode =
      input.decision.policy_codes[0] ?? 'CANVAS_POLICY_BLOCKED';
    const result = await this.databaseService.query<{
      readonly id: string;
      readonly created_at: string;
    }>(
      `
        insert into app.canvas_policy_violations (
          workspace_id,
          automation_id,
          draft_version_id,
          policy_code,
          severity,
          resource_type,
          resource_id,
          operation_type,
          operation_id,
          decision,
          safe_evidence,
          status,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10::jsonb, $11::jsonb, 'blocked', $12)
        returning id, created_at
      `,
      [
        workspaceId,
        input.automationId,
        input.draftVersionId ?? null,
        policyCode,
        input.decision.risk_level,
        input.decision.resource,
        null,
        input.operationType ?? null,
        input.operationId ?? null,
        JSON.stringify(input.decision),
        JSON.stringify(input.safeEvidence ?? {}),
        input.actor.id,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      workspace_id: workspaceId,
      automation_id: input.automationId,
      draft_version_id: input.draftVersionId ?? null,
      policy_code: policyCode,
      severity: input.decision.risk_level,
      resource_type: input.decision.resource,
      resource_id: null,
      status: 'blocked',
      decision: input.decision,
      created_at: row.created_at,
      resolved_at: null,
    };
  }
}

function scanValue(
  value: unknown,
  path: string,
  findings: {
    readonly code: string;
    readonly severity: CanvasRiskLevel;
    readonly overrideAllowed: boolean;
  }[],
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanValue(item, `${path}.${index}`, findings),
    );
    return;
  }
  if (!isRecord(value)) {
    if (typeof value !== 'string') {
      return;
    }
    if (SECRET_LITERAL_VALUE.test(value)) {
      pushFinding(
        findings,
        'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
        'critical',
        false,
      );
    }
    if (SIGNED_URL_VALUE.test(value)) {
      pushFinding(
        findings,
        'WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN',
        'critical',
        false,
      );
    }
    if (UNKNOWN_HTTP_VALUE.test(value)) {
      pushFinding(findings, 'WF_POLICY_007_UNKNOWN_HTTP_DOMAIN', 'high', true);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_LITERAL_KEY.test(key) && typeof child === 'string') {
      pushFinding(
        findings,
        'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
        'critical',
        false,
      );
    }
    scanValue(child, `${path}.${key}`, findings);
  }
}

function pushFinding(
  findings: {
    readonly code: string;
    readonly severity: CanvasRiskLevel;
    readonly overrideAllowed: boolean;
  }[],
  code: string,
  severity: CanvasRiskLevel,
  overrideAllowed: boolean,
) {
  if (findings.some((finding) => finding.code === code)) {
    return;
  }
  findings.push({ code, severity, overrideAllowed });
}

function toPolicy(row: CanvasSecurityPolicyRow): CanvasSecurityPolicy {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    automation_id: row.automation_id,
    code: row.code,
    title: row.title,
    description: row.description,
    severity: row.severity,
    enforcement: row.enforcement,
    enabled: row.enabled,
    allow_override: row.allow_override,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
