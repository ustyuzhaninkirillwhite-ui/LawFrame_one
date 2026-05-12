import type {
  AiEffectivePolicyDto,
  AiPreferenceScopeType,
  AiProviderCode,
  AiRouteCode,
  AiRouteGroup,
} from '@lexframe/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { AiModelRouteRegistryService } from './ai-route-registry.service';

const CHAT_AI_ROUTES = [
  'default_chat',
  'agent_general',
  'rag_legal_summary',
  'document_generation_assist',
  'chat_title_generation',
] as const satisfies readonly AiRouteCode[];

const AUTOMATION_AI_ROUTES = [
  'automation_planner_high',
  'automation_blueprint',
  'canvas_ai_assist',
  'workflow_patch_generation',
  'automation_tool_reasoning',
] as const satisfies readonly AiRouteCode[];

interface PreferenceRow {
  readonly id: string;
  readonly route_group: AiRouteGroup;
  readonly scope_type: AiPreferenceScopeType | AiEffectivePolicyDto['source'];
  readonly workspace_id: string | null;
  readonly user_id: string | null;
  readonly provider_connection_id: string;
  readonly model_id: string;
  readonly enabled: boolean;
  readonly capabilities_confirmed: Record<string, unknown> | null;
  readonly provider_code: AiProviderCode;
  readonly base_url: string | null;
  readonly owner_scope: AiPreferenceScopeType | null;
  readonly owner_user_id: string | null;
  readonly secret_ref_id: string | null;
  readonly secret_status: string | null;
  readonly fingerprint: string | null;
  readonly secret_updated_at: string | null;
  readonly supports_streaming: boolean | null;
  readonly supports_json: boolean | null;
  readonly supports_tool_calls: boolean | null;
}

export interface ResolveEffectivePolicyInput {
  readonly workspaceId: string;
  readonly actorUserId: string | null;
  readonly routeCode?: AiRouteCode;
  readonly routeGroup?: AiRouteGroup;
  readonly permissions: readonly string[];
  readonly traceId?: string | null;
}

@Injectable()
export class AiRouteGroupResolverService {
  constructor(
    @Optional()
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService | undefined,
    private readonly routeRegistry: AiModelRouteRegistryService,
  ) {}

  static routeGroupForRoute(routeCode: AiRouteCode): AiRouteGroup {
    if ((CHAT_AI_ROUTES as readonly string[]).includes(routeCode)) {
      return 'chat_ai';
    }

    if ((AUTOMATION_AI_ROUTES as readonly string[]).includes(routeCode)) {
      return 'automation_ai';
    }

    throw new AppHttpException(
      'AI_ROUTE_GROUP_UNKNOWN',
      400,
      'AI route code does not belong to a Stage 21 route group.',
    );
  }

  static defaultRouteForGroup(routeGroup: AiRouteGroup): AiRouteCode {
    return routeGroup === 'chat_ai'
      ? 'default_chat'
      : 'automation_planner_high';
  }

  async resolveEffectivePolicy(
    input: ResolveEffectivePolicyInput,
  ): Promise<AiEffectivePolicyDto> {
    const routeCode =
      input.routeCode ??
      AiRouteGroupResolverService.defaultRouteForGroup(
        input.routeGroup ?? 'chat_ai',
      );
    const routeGroup =
      input.routeGroup ??
      AiRouteGroupResolverService.routeGroupForRoute(routeCode);

    const preference = await this.findEffectivePreference({
      ...input,
      routeGroup,
    });

    if (preference) {
      const policy = this.mapPreference(preference, routeCode);
      this.assertAutomationCapability(
        policy,
        preference.capabilities_confirmed,
      );
      await this.persistSnapshot(input.workspaceId, input.actorUserId, policy);
      return policy;
    }

    const fallbackRoute = this.routeRegistry.getRoute(routeCode);
    if (!fallbackRoute?.enabled) {
      throw new AppHttpException(
        'AI_ROUTE_NOT_ALLOWED',
        403,
        'AI route group has no enabled route preference or default route.',
      );
    }

    const policy: AiEffectivePolicyDto = {
      routeGroup,
      routeCode,
      source: 'stage18_default_route',
      providerConnectionId: fallbackRoute.providerConnectionId,
      providerCode: fallbackRoute.providerCode,
      modelId: fallbackRoute.model,
      baseUrl: null,
      hasSecret: false,
      secretStatus: 'missing',
      fingerprint: null,
      supportsStreaming: fallbackRoute.supportsStreaming,
      supportsJson: fallbackRoute.supportsJson,
      supportsToolCalls: fallbackRoute.supportsToolCalls,
      ...runtimePolicyMetadata(false),
      policyDecisionId: stablePolicyDecisionId({
        routeGroup,
        routeCode,
        providerConnectionId: fallbackRoute.providerConnectionId,
        modelId: fallbackRoute.model,
      }),
      resolvedAt: new Date().toISOString(),
    };

    this.assertAutomationCapability(policy, {
      structuredJsonSchema: fallbackRoute.supportsJson,
      jsonMode: fallbackRoute.supportsJson,
    });
    await this.persistSnapshot(input.workspaceId, input.actorUserId, policy);
    return policy;
  }

  async resolveRouteSnapshot(input: ResolveEffectivePolicyInput) {
    const policy = await this.resolveEffectivePolicy(input);
    return {
      route: policy.routeCode,
      provider: policy.providerCode,
      model: policy.modelId,
      keyFingerprint: policy.fingerprint,
      policyDecision: policy.policyDecisionId,
    };
  }

  private async findEffectivePreference(input: {
    readonly workspaceId: string;
    readonly actorUserId: string | null;
    readonly routeGroup: AiRouteGroup;
    readonly permissions: readonly string[];
  }): Promise<PreferenceRow | null> {
    if (!this.databaseService) {
      return null;
    }

    const canUseRuntimeRoute =
      (input.routeGroup === 'chat_ai' &&
        input.permissions.includes('ai.chat.use')) ||
      (input.routeGroup === 'automation_ai' &&
        input.permissions.includes('canvas.ai.use'));
    const canViewSettingsPolicy =
      input.permissions.includes('settings.ai.view') ||
      input.permissions.includes('settings.ai.effective_policy.view');
    const canUseSelfPreference =
      input.actorUserId !== null &&
      (input.permissions.includes('settings.ai.manage_self') ||
        canUseRuntimeRoute ||
        canViewSettingsPolicy);
    const canUseWorkspacePreference =
      input.permissions.includes('settings.ai.manage_workspace') ||
      canUseRuntimeRoute ||
      canViewSettingsPolicy;

    const candidates: Array<{
      readonly source:
        | 'user_preference'
        | 'workspace_preference'
        | 'system_default';
      readonly scopeType: AiPreferenceScopeType;
      readonly userId: string | null;
      readonly allowed: boolean;
    }> = [
      {
        source: 'user_preference',
        scopeType: 'user',
        userId: input.actorUserId,
        allowed: canUseSelfPreference,
      },
      {
        source: 'workspace_preference',
        scopeType: 'workspace',
        userId: null,
        allowed: canUseWorkspacePreference || canUseSelfPreference,
      },
      {
        source: 'system_default',
        scopeType: 'system',
        userId: null,
        allowed: true,
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.allowed) {
        continue;
      }

      let row: PreferenceRow | null;
      try {
        row = await this.databaseService.one<PreferenceRow>(
          `
            select
              p.id,
              p.route_group,
              p.scope_type,
              p.workspace_id::text,
              p.user_id::text,
              p.provider_connection_id,
              coalesce(p.model_id, c.default_model) as model_id,
              p.enabled,
              p.capabilities_confirmed,
              c.provider_code,
              c.base_url,
              c.owner_scope,
              c.owner_user_id::text,
              c.secret_ref_id::text,
              s.status as secret_status,
              s.fingerprint,
              s.last_rotated_at::text as secret_updated_at,
              coalesce((p.capabilities_confirmed->>'streaming')::boolean, true) as supports_streaming,
              (
                coalesce((p.capabilities_confirmed->>'structuredJsonSchema')::boolean, false)
                or coalesce((p.capabilities_confirmed->>'jsonMode')::boolean, false)
                or coalesce((p.capabilities_confirmed->>'json_schema_output')::boolean, false)
              ) as supports_json,
              coalesce((p.capabilities_confirmed->>'toolCalls')::boolean, true) as supports_tool_calls
            from app.ai_route_group_preferences p
            inner join app.ai_provider_connections c
              on c.id = p.provider_connection_id
            left join app.ai_secret_refs s
              on s.id = c.secret_ref_id
            where p.route_group = $1
              and p.scope_type = $2
              and p.enabled = true
              and c.enabled = true
              and (
                p.scope_type = 'system'
                or p.workspace_id = $3::uuid
              )
              and (
                $4::uuid is null
                or p.user_id = $4::uuid
              )
            order by p.updated_at desc
            limit 1
          `,
          [
            input.routeGroup,
            candidate.scopeType,
            input.workspaceId,
            candidate.userId,
          ],
        );
      } catch (error) {
        if (isMissingStage21Schema(error)) {
          return null;
        }

        throw error;
      }

      if (row) {
        return {
          ...row,
          scope_type: candidate.source as PreferenceRow['scope_type'],
        };
      }
    }

    return null;
  }

  private mapPreference(
    row: PreferenceRow,
    routeCode: AiRouteCode,
  ): AiEffectivePolicyDto {
    const source =
      row.scope_type === 'user_preference' ||
      row.scope_type === 'workspace_preference' ||
      row.scope_type === 'system_default'
        ? row.scope_type
        : row.scope_type === 'user'
          ? 'user_preference'
          : row.scope_type === 'workspace'
            ? 'workspace_preference'
            : 'system_default';

    const fingerprint = row.fingerprint ?? null;

    return {
      routeGroup: row.route_group,
      routeCode,
      source,
      providerConnectionId: row.provider_connection_id,
      providerCode: row.provider_code,
      modelId: row.model_id,
      baseUrl: row.base_url,
      hasSecret: Boolean(fingerprint),
      secretStatus: fingerprint ? 'active' : 'missing',
      fingerprint,
      supportsStreaming: row.supports_streaming ?? true,
      supportsJson: row.supports_json ?? false,
      supportsToolCalls: row.supports_tool_calls ?? false,
      ...runtimePolicyMetadata(true),
      policyDecisionId: stablePolicyDecisionId({
        routeGroup: row.route_group,
        routeCode,
        providerConnectionId: row.provider_connection_id,
        modelId: row.model_id,
      }),
      resolvedAt: new Date().toISOString(),
    };
  }

  private assertAutomationCapability(
    policy: AiEffectivePolicyDto,
    capabilities: Record<string, unknown> | null,
  ) {
    if (policy.routeGroup !== 'automation_ai') {
      return;
    }

    const confirmed =
      capabilities?.structuredJsonSchema === true ||
      capabilities?.json_schema_output === true ||
      capabilities?.jsonMode === true ||
      policy.supportsJson;

    if (!confirmed) {
      throw new AppHttpException(
        'AI_AUTOMATION_MODEL_CAPABILITY_BLOCKED',
        403,
        'Automation AI requires confirmed structured JSON/schema output support.',
      );
    }
  }

  private async persistSnapshot(
    workspaceId: string,
    actorUserId: string | null,
    policy: AiEffectivePolicyDto,
  ) {
    if (!this.databaseService) {
      return;
    }

    try {
      await this.databaseService.query(
        `
          insert into app.ai_effective_route_snapshots (
            id,
            workspace_id,
            user_id,
            route_group,
            route_code,
            provider_connection_id,
            provider_code,
            model_id,
            source,
            policy_decision_id,
            safe_snapshot
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        `,
        [
          randomUUID(),
          workspaceId,
          actorUserId,
          policy.routeGroup,
          policy.routeCode,
          policy.providerConnectionId,
          policy.providerCode,
          policy.modelId,
          policy.source,
          policy.policyDecisionId,
          JSON.stringify(policy),
        ],
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '42P01'
      ) {
        return;
      }

      throw error;
    }
  }
}

function isMissingStage21Schema(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ['42P01', '42703'].includes(String((error as { code?: string }).code))
  );
}

function runtimePolicyMetadata(
  savedConnection: boolean,
): Pick<
  AiEffectivePolicyDto,
  'runtimeMode' | 'runtimeNotice' | 'runtimeUsesSavedConnection'
> {
  const mode = normalizeAiProviderMode(process.env.AI_PROVIDER_MODE);

  return {
    runtimeMode: mode,
    runtimeUsesSavedConnection: mode !== 'mock' && savedConnection,
    runtimeNotice:
      mode === 'mock'
        ? 'AI_PROVIDER_MODE=mock: runtime AI calls use the local mock provider; saved provider keys are retained but not used.'
        : null,
  };
}

function normalizeAiProviderMode(
  value: string | undefined,
): AiEffectivePolicyDto['runtimeMode'] {
  if (
    value === 'mock' ||
    value === 'controlled-real' ||
    value === 'env-secret'
  ) {
    return value;
  }

  return 'unknown';
}

function stablePolicyDecisionId(value: {
  readonly routeGroup: AiRouteGroup;
  readonly routeCode: AiRouteCode;
  readonly providerConnectionId: string;
  readonly modelId: string;
}) {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 24);
}
