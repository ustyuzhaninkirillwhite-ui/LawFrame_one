import type {
  AiConnectionTestResultDto,
  AiEffectivePolicyDto,
  AiEffectivePolicyResponse,
  AiProviderCode,
  AiProviderConnectionCapabilities,
  AiProviderConnectionDto,
  AiRouteGroup,
  AiRouteGroupPreferenceDto,
  AiSettingsResponse,
  CreateAiProviderConnectionRequest,
  UpdateAiProviderConnectionRequest,
  UpdateAiRouteGroupPreferenceRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AiRouteGroupResolverService } from '../ai-gateway/ai-route-group-resolver.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import {
  AiBaseUrlGuardError,
  validateAiProviderBaseUrl,
} from './ai-base-url-ssrf.guard';
import { AiSecretService } from './ai-secret.service';
import { redactSecrets, redactText } from './settings-redactor';

interface ProviderConnectionRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly owner_scope: 'user' | 'workspace' | 'system';
  readonly owner_user_id: string | null;
  readonly provider_code: AiProviderCode;
  readonly ui_label: string | null;
  readonly display_name: string | null;
  readonly base_url: string;
  readonly default_model: string;
  readonly enabled: boolean;
  readonly provider_metadata_redacted: Record<string, unknown> | null;
  readonly secret_ref_id: string | null;
  readonly secret_status: string | null;
  readonly secret_backend: string | null;
  readonly fingerprint: string | null;
  readonly secret_updated_at: string | null;
  readonly last_test_status: AiConnectionTestResultDto['status'] | null;
  readonly last_tested_at: string | null;
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface PreferenceRow {
  readonly route_group: AiRouteGroup;
  readonly scope_type: 'user' | 'workspace' | 'system';
  readonly workspace_id: string | null;
  readonly user_id: string | null;
  readonly provider_connection_id: string | null;
  readonly provider_code: AiProviderCode | null;
  readonly model_id: string | null;
  readonly enabled: boolean;
  readonly capabilities_confirmed: Record<string, unknown> | null;
  readonly updated_at: string | null;
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly aiSecretService: AiSecretService,
    private readonly routeGroupResolver: AiRouteGroupResolverService,
  ) {}

  async getSettings(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiSettingsResponse> {
    const workspaceId = requireWorkspace(input.access);
    const [providerConnections, routeGroups, effectivePolicies] =
      await Promise.all([
        this.listProviderConnections(workspaceId, input.actor.id),
        this.listRouteGroupPreferences(workspaceId, input.actor.id),
        this.resolveEffectivePolicies(input.access, input.actor.id, input.traceId),
      ]);

    return {
      providerConnections,
      routeGroups,
      effectivePolicies,
    };
  }

  async createProviderConnection(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly request: CreateAiProviderConnectionRequest;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiProviderConnectionDto> {
    const workspaceId = requireWorkspace(input.access);
    const ownerScope = resolveOwnerScope(input.access, input.request.ownerScope);
    assertManagePermission(input.access, ownerScope);
    assertSecretCreatePermission(input.access, ownerScope, input.request.apiKey);
    assertRouteGroup(input.request.routeGroup);
    assertAutomationCapabilities(input.request.routeGroup, input.request.capabilities);

    const baseUrl = await validateConfiguredAiProviderBaseUrl(
      input.request.baseUrl,
    );
    const connectionId = randomUUID();
    let secret: Awaited<
      ReturnType<AiSecretService['createOrRotateSecret']>
    > | null = null;

    await this.databaseService.query(
      `
        insert into app.ai_provider_connections (
          id,
          workspace_id,
          owner_scope,
          owner_user_id,
          provider_code,
          display_name,
          ui_label,
          base_url,
          api_key_ref,
          secret_ref_id,
          enabled,
          model_discovery_mode,
          allowed_models,
          default_model,
          provider_metadata_redacted
        )
        values ($1, $2, $3, $4, $5, $6, $6, $7, $8::text, $9::uuid, true, 'manual_allowlist', $10::text[], $11, $12::jsonb)
      `,
      [
        connectionId,
        workspaceId,
        ownerScope,
        ownerScope === 'user' ? input.actor.id : null,
        input.request.providerCode,
        input.request.uiLabel ??
          `${input.request.providerCode} ${input.request.modelId}`,
        baseUrl,
        `ai_provider_connection:${connectionId}:missing_secret`,
        null,
        [input.request.modelId],
        input.request.modelId,
        JSON.stringify({
          capabilities: input.request.capabilities ?? {},
        }),
      ],
    );

    if (input.request.apiKey) {
      secret = await this.aiSecretService.createOrRotateSecret({
        actor: input.actor,
        workspaceId,
        ownerScope,
        ownerUserId: ownerScope === 'user' ? input.actor.id : null,
        providerConnectionId: connectionId,
        providerCode: input.request.providerCode,
        apiKey: input.request.apiKey,
      });

      await this.databaseService.query(
        `
          update app.ai_provider_connections
          set secret_ref_id = $3::uuid,
              api_key_ref = $4::text,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [connectionId, workspaceId, secret.secretRefId, secret.secretRefId],
      );
    }

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.ai.provider_connection.created',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        scope_type: ownerScope,
        route_group: input.request.routeGroup,
        provider_code: input.request.providerCode,
        model_id: input.request.modelId,
        connection_id: connectionId,
        secret_ref_id: secret?.secretRefId ?? null,
        fingerprint: secret?.fingerprint ?? null,
        status: 'created',
      },
    });

    if (secret) {
      await this.audit({
        actor: input.actor,
        workspaceId,
        action: 'settings.ai.secret.created',
        result: 'success',
        requestId: input.requestId,
        traceId: input.traceId,
        metadata: {
          scope_type: ownerScope,
          provider_code: input.request.providerCode,
          model_id: input.request.modelId,
          connection_id: connectionId,
          secret_ref_id: secret.secretRefId,
          fingerprint: secret.fingerprint,
          status: 'active',
        },
      });
    }

    return this.getProviderConnectionOrThrow(workspaceId, input.actor.id, connectionId);
  }

  async updateProviderConnection(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly connectionId: string;
    readonly request: UpdateAiProviderConnectionRequest;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiProviderConnectionDto> {
    const workspaceId = requireWorkspace(input.access);
    const current = await this.getRawConnection(workspaceId, input.connectionId);
    assertManagePermission(input.access, current.owner_scope);
    const baseUrl = input.request.baseUrl
      ? await validateConfiguredAiProviderBaseUrl(input.request.baseUrl)
      : null;

    await this.databaseService.query(
      `
        update app.ai_provider_connections
        set
          provider_code = coalesce($3, provider_code),
          display_name = coalesce($4, display_name),
          ui_label = coalesce($4, ui_label),
          base_url = coalesce($5, base_url),
          default_model = coalesce($6, default_model),
          allowed_models = case when $6::text is null then allowed_models else array[$6]::text[] end,
          enabled = coalesce($7, enabled),
          provider_metadata_redacted = coalesce($8::jsonb, provider_metadata_redacted),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [
        input.connectionId,
        workspaceId,
        input.request.providerCode ?? null,
        input.request.uiLabel ?? null,
        baseUrl,
        input.request.modelId ?? null,
        input.request.enabled ?? null,
        input.request.capabilities
          ? JSON.stringify({ capabilities: input.request.capabilities })
          : null,
      ],
    );

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.ai.provider_connection.updated',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        provider_code: input.request.providerCode ?? current.provider_code,
        model_id: input.request.modelId ?? current.default_model,
        connection_id: input.connectionId,
        status: 'updated',
      },
    });

    return this.getProviderConnectionOrThrow(
      workspaceId,
      input.actor.id,
      input.connectionId,
    );
  }

  async replaceSecret(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly connectionId: string;
    readonly apiKey: string;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiProviderConnectionDto> {
    const workspaceId = requireWorkspace(input.access);
    const current = await this.getRawConnection(workspaceId, input.connectionId);
    assertManagePermission(input.access, current.owner_scope);
    assertSecretRotatePermission(input.access, current.owner_scope);
    const secret = await this.aiSecretService.createOrRotateSecret({
      actor: input.actor,
      workspaceId,
      ownerScope: current.owner_scope,
      ownerUserId: current.owner_user_id,
      providerConnectionId: input.connectionId,
      providerCode: current.provider_code,
      apiKey: input.apiKey,
      previousSecretRefId: current.secret_ref_id,
    });

    await this.databaseService.query(
      `
        update app.ai_provider_connections
        set secret_ref_id = $3::uuid,
            api_key_ref = $4::text,
            updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [input.connectionId, workspaceId, secret.secretRefId, secret.secretRefId],
    );

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: current.secret_ref_id
        ? 'settings.ai.secret.rotated'
        : 'settings.ai.secret.created',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        provider_code: current.provider_code,
        model_id: current.default_model,
        connection_id: input.connectionId,
        secret_ref_id: secret.secretRefId,
        fingerprint: secret.fingerprint,
        status: 'active',
      },
    });

    return this.getProviderConnectionOrThrow(
      workspaceId,
      input.actor.id,
      input.connectionId,
    );
  }

  async testConnection(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly connectionId: string;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiConnectionTestResultDto> {
    const workspaceId = requireWorkspace(input.access);
    if (!input.access.permissions.includes('settings.ai.connection.test')) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Connection testing permission is required.',
      );
    }

    const current = await this.getRawConnection(workspaceId, input.connectionId);
    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.ai.connection.test.started',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        provider_code: current.provider_code,
        model_id: current.default_model,
        connection_id: input.connectionId,
        status: 'started',
      },
    });

    const startedAt = Date.now();
    const result = await this.runMinimalConnectionTest(workspaceId, current);
    const latencyMs = Date.now() - startedAt;
    const testedAt = new Date().toISOString();
    const response: AiConnectionTestResultDto = {
      providerConnectionId: input.connectionId,
      status: result.status,
      latencyMs,
      testedAt,
      errorCode: result.errorCode,
      message: result.message,
      redacted: true,
    };

    await this.databaseService.query(
      `
        insert into app.ai_provider_connection_tests (
          id,
          workspace_id,
          provider_connection_id,
          status,
          latency_ms,
          error_code,
          response_metadata_redacted,
          tested_by
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        randomUUID(),
        workspaceId,
        input.connectionId,
        response.status,
        response.latencyMs,
        response.errorCode,
        JSON.stringify(redactSecrets(response)),
        input.actor.id,
      ],
    );

    await this.databaseService.query(
      `
        update app.ai_provider_connections
        set last_test_status = $3,
            last_tested_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [input.connectionId, workspaceId, response.status],
    );

    await this.audit({
      actor: input.actor,
      workspaceId,
      action:
        response.status === 'success'
          ? 'settings.ai.connection.test.completed'
          : 'settings.ai.connection.test.failed',
      result: response.status === 'success' ? 'success' : 'error',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        provider_code: current.provider_code,
        model_id: current.default_model,
        connection_id: input.connectionId,
        status: response.status,
        latency_ms: response.latencyMs,
        error_code: response.errorCode,
      },
    });

    return response;
  }

  async updateRouteGroupPreference(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly routeGroup: AiRouteGroup;
    readonly request: UpdateAiRouteGroupPreferenceRequest;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<AiRouteGroupPreferenceDto> {
    const workspaceId = requireWorkspace(input.access);
    assertRouteGroup(input.routeGroup);
    assertManagePermission(input.access, input.request.scopeType);
    assertAutomationCapabilities(
      input.routeGroup,
      input.request.capabilitiesConfirmed,
    );
    const connection = await this.getRawConnection(
      workspaceId,
      input.request.providerConnectionId,
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          delete from app.ai_route_group_preferences
          where workspace_id = $1
            and route_group = $2
            and scope_type = $3
            and (
              ($3 = 'user' and user_id = $4::uuid)
              or ($3 = 'workspace' and user_id is null)
            )
        `,
        [
          workspaceId,
          input.routeGroup,
          input.request.scopeType,
          input.actor.id,
        ],
      );

      await client.query(
        `
          insert into app.ai_route_group_preferences (
            id,
            workspace_id,
            user_id,
            route_group,
            scope_type,
            provider_connection_id,
            model_id,
            enabled,
            capabilities_confirmed,
            updated_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, true), $9::jsonb, $10)
        `,
        [
          randomUUID(),
          workspaceId,
          input.request.scopeType === 'user' ? input.actor.id : null,
          input.routeGroup,
          input.request.scopeType,
          input.request.providerConnectionId,
          input.request.modelId ?? connection.default_model,
          input.request.enabled ?? true,
          JSON.stringify(input.request.capabilitiesConfirmed ?? {}),
          input.actor.id,
        ],
      );
    });

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.ai.route_group.preference.updated',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: {
        scope_type: input.request.scopeType,
        route_group: input.routeGroup,
        provider_code: connection.provider_code,
        model_id: input.request.modelId ?? connection.default_model,
        connection_id: input.request.providerConnectionId,
        status: 'updated',
      },
    });

    const preferences = await this.listRouteGroupPreferences(
      workspaceId,
      input.actor.id,
    );
    const saved = preferences.find(
      (preference) =>
        preference.routeGroup === input.routeGroup &&
        preference.scopeType === input.request.scopeType,
    );

    if (!saved) {
      throw new AppHttpException(
        'AI_POLICY_BLOCKED',
        500,
        'AI route group preference was not saved.',
      );
    }

    return saved;
  }

  async getEffectivePolicy(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly traceId: string | null;
  }): Promise<AiEffectivePolicyResponse> {
    return {
      policies: await this.resolveEffectivePolicies(
        input.access,
        input.actor.id,
        input.traceId,
      ),
    };
  }

  private async listProviderConnections(
    workspaceId: string,
    actorUserId: string,
  ): Promise<readonly AiProviderConnectionDto[]> {
    const result = await this.databaseService.query<ProviderConnectionRow>(
      `
        select
          c.id,
          c.workspace_id::text,
          c.owner_scope,
          c.owner_user_id::text,
          c.provider_code,
          c.ui_label,
          c.display_name,
          c.base_url,
          c.default_model,
          c.enabled,
          c.provider_metadata_redacted,
          c.secret_ref_id::text,
          s.status as secret_status,
          s.backend as secret_backend,
          s.fingerprint,
          s.last_rotated_at::text as secret_updated_at,
          c.last_test_status,
          c.last_tested_at::text,
          c.last_used_at::text,
          c.created_at::text,
          c.updated_at::text
        from app.ai_provider_connections c
        left join app.ai_secret_refs s
          on s.id = c.secret_ref_id
        where c.workspace_id = $1
          and (
            c.owner_scope = 'workspace'
            or c.owner_user_id = $2
          )
        order by c.updated_at desc
      `,
      [workspaceId, actorUserId],
    );

    return result.rows.map(mapProviderConnection);
  }

  private async getProviderConnectionOrThrow(
    workspaceId: string,
    actorUserId: string,
    connectionId: string,
  ): Promise<AiProviderConnectionDto> {
    const connections = await this.listProviderConnections(workspaceId, actorUserId);
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      throw new AppHttpException(
        'AI_PROVIDER_UNAVAILABLE',
        404,
        'AI provider connection was not found.',
      );
    }

    return connection;
  }

  private async getRawConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<ProviderConnectionRow> {
    const row = await this.databaseService.one<ProviderConnectionRow>(
      `
        select
          c.id,
          c.workspace_id::text,
          c.owner_scope,
          c.owner_user_id::text,
          c.provider_code,
          c.ui_label,
          c.display_name,
          c.base_url,
          c.default_model,
          c.enabled,
          c.provider_metadata_redacted,
          c.secret_ref_id::text,
          s.status as secret_status,
          s.backend as secret_backend,
          s.fingerprint,
          s.last_rotated_at::text as secret_updated_at,
          c.last_test_status,
          c.last_tested_at::text,
          c.last_used_at::text,
          c.created_at::text,
          c.updated_at::text
        from app.ai_provider_connections c
        left join app.ai_secret_refs s
          on s.id = c.secret_ref_id
        where c.workspace_id = $1
          and c.id = $2
        limit 1
      `,
      [workspaceId, connectionId],
    );

    if (!row) {
      throw new AppHttpException(
        'AI_PROVIDER_UNAVAILABLE',
        404,
        'AI provider connection was not found.',
      );
    }

    return row;
  }

  private async listRouteGroupPreferences(
    workspaceId: string,
    actorUserId: string,
  ): Promise<readonly AiRouteGroupPreferenceDto[]> {
    const result = await this.databaseService.query<PreferenceRow>(
      `
        select
          p.route_group,
          p.scope_type,
          p.workspace_id::text,
          p.user_id::text,
          p.provider_connection_id,
          c.provider_code,
          p.model_id,
          p.enabled,
          p.capabilities_confirmed,
          p.updated_at::text
        from app.ai_route_group_preferences p
        left join app.ai_provider_connections c
          on c.id = p.provider_connection_id
        where p.workspace_id = $1
          and (
            p.scope_type = 'workspace'
            or p.user_id = $2
          )
        order by p.route_group asc, p.scope_type asc
      `,
      [workspaceId, actorUserId],
    );

    return result.rows.map((row) => ({
      routeGroup: row.route_group,
      scopeType: row.scope_type,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      providerConnectionId: row.provider_connection_id,
      providerCode: row.provider_code,
      modelId: row.model_id,
      enabled: row.enabled,
      capabilitiesConfirmed: toCapabilities(row.capabilities_confirmed),
      updatedAt: row.updated_at,
    }));
  }

  private async resolveEffectivePolicies(
    access: AccessContext,
    actorUserId: string,
    traceId: string | null,
  ): Promise<readonly AiEffectivePolicyDto[]> {
    const workspaceId = requireWorkspace(access);
    return Promise.all(
      (['chat_ai', 'automation_ai'] as const).map((routeGroup) =>
        this.routeGroupResolver.resolveEffectivePolicy({
          workspaceId,
          actorUserId,
          routeGroup,
          permissions: access.permissions,
          traceId,
        }),
      ),
    );
  }

  private async runMinimalConnectionTest(
    workspaceId: string,
    connection: ProviderConnectionRow,
  ): Promise<{
    readonly status: AiConnectionTestResultDto['status'];
    readonly errorCode: string | null;
    readonly message: string;
  }> {
    if (!connection.fingerprint) {
      return {
        status: 'blocked',
        errorCode: 'AI_SECRET_MISSING',
        message: 'Connection has no saved API key.',
      };
    }

    if (process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS !== '1') {
      return {
        status: 'success',
        errorCode: null,
        message: 'Backend health check completed without sending user prompts.',
      };
    }

    try {
      const runtimeSecret =
        await this.aiSecretService.resolveProviderCallSecret({
          workspaceId,
          providerConnectionId: connection.id,
        });
      const response = await fetch(`${runtimeSecret.baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${runtimeSecret.apiKey.revealForProviderCall()}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok
        ? {
            status: 'success',
            errorCode: null,
            message: 'Provider models endpoint responded to a prompt-free health check.',
          }
        : {
            status: 'failed',
            errorCode: `HTTP_${response.status}`,
            message: redactText(`Provider health check failed with HTTP ${response.status}.`),
          };
    } catch (error) {
      if (error instanceof AppHttpException) {
        return {
          status: 'blocked',
          errorCode: error.code,
          message: redactText(error.message),
        };
      }

      return {
        status: 'failed',
        errorCode: 'PROVIDER_HEALTH_CHECK_FAILED',
        message: redactText(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  private audit(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly action: string;
    readonly result: 'success' | 'denied' | 'error';
    readonly requestId: string | null;
    readonly traceId: string | null;
    readonly metadata: Record<string, unknown>;
  }) {
    return this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: 'ai_settings',
      entityId: String(input.metadata.connection_id ?? input.workspaceId),
      result: input.result,
      requestId: input.requestId,
      traceId: input.traceId,
      eventCategory: 'settings',
      redactionApplied: true,
      metadata: redactSecrets(input.metadata),
    });
  }
}

function mapProviderConnection(row: ProviderConnectionRow): AiProviderConnectionDto {
  const capabilities = toCapabilities(
    row.provider_metadata_redacted?.capabilities as
      | Record<string, unknown>
      | undefined,
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerScope: row.owner_scope,
    ownerUserId: row.owner_user_id,
    providerCode: row.provider_code,
    uiLabel: row.ui_label ?? row.display_name ?? row.provider_code,
    baseUrl: row.base_url,
    modelId: row.default_model,
    enabled: row.enabled,
    secret: {
      hasSecret: Boolean(row.fingerprint),
      secretStatus: row.fingerprint ? 'active' : 'missing',
      fingerprint: row.fingerprint,
      lastUpdatedAt: row.secret_updated_at,
      backend: row.secret_backend as AiProviderConnectionDto['secret']['backend'],
    },
    capabilities,
    lastTestStatus: row.last_test_status ?? 'not_tested',
    lastTestedAt: row.last_tested_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCapabilities(
  value: Record<string, unknown> | null | undefined,
): AiProviderConnectionCapabilities {
  return {
    streaming: value?.streaming === true,
    jsonMode: value?.jsonMode === true,
    structuredJsonSchema: value?.structuredJsonSchema === true,
    toolCalls: value?.toolCalls === true,
  };
}

function requireWorkspace(access: AccessContext): string {
  if (!access.activeWorkspace?.id) {
    throw new AppHttpException(
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
      'Workspace context is required.',
    );
  }

  return access.activeWorkspace.id;
}

function resolveOwnerScope(
  access: AccessContext,
  requested: 'user' | 'workspace' | undefined,
): 'user' | 'workspace' {
  const ownerScope = requested ?? 'user';
  assertManagePermission(access, ownerScope);
  return ownerScope;
}

function assertManagePermission(
  access: AccessContext,
  ownerScope: 'user' | 'workspace' | 'system',
) {
  const permission =
    ownerScope === 'workspace'
      ? 'settings.ai.manage_workspace'
      : 'settings.ai.manage_self';

  if (!access.permissions.includes(permission)) {
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      'AI settings management permission is required.',
      { missingPermissions: [permission] },
    );
  }
}

function assertSecretCreatePermission(
  access: AccessContext,
  ownerScope: 'user' | 'workspace',
  apiKey: string | null | undefined,
) {
  if (!apiKey) {
    return;
  }

  const permission =
    ownerScope === 'workspace'
      ? 'settings.ai.secret.create_workspace'
      : 'settings.ai.secret.create_self';

  if (!access.permissions.includes(permission)) {
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      'AI secret creation permission is required.',
      { missingPermissions: [permission] },
    );
  }
}

function assertSecretRotatePermission(
  access: AccessContext,
  ownerScope: 'user' | 'workspace' | 'system',
) {
  const permission =
    ownerScope === 'workspace'
      ? 'settings.ai.secret.rotate_workspace'
      : 'settings.ai.secret.rotate_self';

  if (!access.permissions.includes(permission)) {
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      'AI secret rotation permission is required.',
      { missingPermissions: [permission] },
    );
  }
}

function assertRouteGroup(routeGroup: string): asserts routeGroup is AiRouteGroup {
  if (routeGroup !== 'chat_ai' && routeGroup !== 'automation_ai') {
    throw new AppHttpException(
      'AI_ROUTE_GROUP_UNKNOWN',
      400,
      'Unsupported AI route group.',
    );
  }
}

function assertAutomationCapabilities(
  routeGroup: AiRouteGroup,
  capabilities: AiProviderConnectionCapabilities | undefined,
) {
  if (routeGroup !== 'automation_ai') {
    return;
  }

  if (!capabilities?.structuredJsonSchema && !capabilities?.jsonMode) {
    throw new AppHttpException(
      'AI_AUTOMATION_MODEL_CAPABILITY_BLOCKED',
      403,
      'Automation AI requires confirmed structured JSON/schema output support.',
    );
  }
}

function parseAllowlist(value: string | undefined): readonly string[] | undefined {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items?.length ? items : undefined;
}

async function validateConfiguredAiProviderBaseUrl(rawUrl: string) {
  try {
    return await validateAiProviderBaseUrl(rawUrl, {
      production: isProductionAiDeploy(),
      allowlist: parseAllowlist(process.env.LEXFRAME_AI_BASE_URL_ALLOWLIST),
    });
  } catch (error) {
    if (error instanceof AiBaseUrlGuardError) {
      throw new AppHttpException(error.code, 400, error.message);
    }

    throw error;
  }
}

function isProductionAiDeploy() {
  return (
    process.env.LEXFRAME_DEPLOY_ENV === 'production' ||
    process.env.LEXFRAME_ENV_PROFILE === 'production'
  );
}
