import type {
  ActivepiecesCanvasReadinessWireResponse,
  ActivepiecesSessionPreferredMode,
  ActivepiecesSessionReadyWireResponse,
  ActivepiecesSessionWireResponse,
  InitializeActivepiecesSessionWireResponse,
  CreateActivepiecesSessionRequest,
  AutomationCanvasReadinessCode,
  RecordActivepiecesIframeHealthRequest,
  RecordActivepiecesIframeHealthWireResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { DatabaseService } from '../database/database.service';
import { LocalOwnerKeyVaultService } from '../local-owner-key-vault/local-owner-key-vault.service';
import type { SafeLocalKeysStatus } from '../local-owner-key-vault/local-owner-key-vault.types';
import { ActivepiecesAuditWriter } from './activepieces-audit-writer';
import { ActivepiecesCanvasProvisioningService } from './activepieces-canvas-provisioning.service';
import { ActivepiecesCanvasReadinessService } from './activepieces-canvas-readiness.service';
import { ActivepiecesFlowProvisioningService } from './activepieces-flow-provisioning.service';
import { ActivepiecesIdentityBridge } from './activepieces-identity-bridge';
import { ActivepiecesJwtSigner } from './activepieces-jwt-signer';
import { ActivepiecesPiecesPolicyService } from './activepieces-pieces-policy.service';
import { ActivepiecesRoleMapper } from './activepieces-role-mapper';
import type {
  ActivepiecesInstalledAutomationForSession,
  ActivepiecesModeDecision,
  ActivepiecesSessionCacheEntry,
  ActivepiecesSessionRequestMeta,
  ActivepiecesWorkspaceSecurityForSession,
} from './activepieces-session.types';

interface WorkspaceSecurityRow {
  readonly workspace_id: string;
  readonly token_ttl_seconds: number;
  readonly pieces_filter_type: string;
  readonly pieces_tags: readonly string[] | null;
  readonly incident_lock_active: boolean;
}

interface InitializedSessionRow {
  readonly id: string;
  readonly initialized_at: string;
  readonly installed_automation_id: string;
}

interface ManagedAuthnSessionRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly auth_user_id: string;
  readonly installed_automation_id: string;
}

interface ManagedAuthnBindingRow {
  readonly ap_user_id: string | null;
  readonly external_user_id: string | null;
  readonly ap_project_id: string | null;
  readonly email: string | null;
  readonly full_name: string | null;
}

interface ResolvedAutomationForSession {
  readonly automation: ActivepiecesInstalledAutomationForSession;
  readonly canonicalReplacementRoute: string | null;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const SUCCESS_SESSION_LIMIT = 10;
const FAILED_SESSION_LIMIT = 5;
const STAGE17_ACTIVEPIECES_PLATFORM_ID = 'lfstg17platform000001';
const ACTIVEPIECES_CANVAS_CANONICAL_SYNC_HASH =
  'stage21-activepieces-0.82-canvas-v1';
const ACTIVEPIECES_RUNTIME_PROBE_ATTEMPTS = 3;
const ACTIVEPIECES_RUNTIME_PROBE_TIMEOUT_MS = 5_000;
const ACTIVEPIECES_RUNTIME_PROBE_RETRY_DELAY_MS = 400;
const ACTIVEPIECES_CANVAS_REFRESH_POLICY = {
  strategy: 'no_foreground_refresh',
  recover_on: ['auth', 'invalid_access', 'stuck_loading'],
} as const;

@Injectable()
export class ActivepiecesSessionService {
  private readonly env = loadServerEnv();
  private readonly idempotencyCache = new Map<
    string,
    ActivepiecesSessionCacheEntry
  >();
  private readonly successfulWindows = new Map<string, RateWindow>();
  private readonly failedWindows = new Map<string, RateWindow>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly roleMapper: ActivepiecesRoleMapper,
    private readonly piecesPolicyService: ActivepiecesPiecesPolicyService,
    private readonly identityBridge: ActivepiecesIdentityBridge,
    private readonly canvasProvisioningService: ActivepiecesCanvasProvisioningService,
    private readonly flowProvisioningService: ActivepiecesFlowProvisioningService,
    private readonly canvasReadinessService: ActivepiecesCanvasReadinessService,
    private readonly jwtSigner: ActivepiecesJwtSigner,
    private readonly auditWriter: ActivepiecesAuditWriter,
    private readonly localOwnerKeyVaultService: LocalOwnerKeyVaultService,
  ) {}

  async createSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateActivepiecesSessionRequest,
    meta: ActivepiecesSessionRequestMeta,
  ): Promise<ActivepiecesSessionWireResponse> {
    const workspaceId = access.activeWorkspace?.id ?? null;
    const traceMeta = {
      ...meta,
      traceId: input.clientTraceId ?? meta.traceId,
    };

    try {
      if (this.env.ACTIVEPIECES_MVP_CANVAS_ENABLED === '0') {
        throw new AppHttpException(
          'FEATURE_DISABLED',
          503,
          'Activepieces Canvas is disabled.',
        );
      }

      if (
        !workspaceId ||
        (input.workspaceId && input.workspaceId !== workspaceId)
      ) {
        throw new AppHttpException(
          'WORKSPACE_ACCESS_DENIED',
          403,
          'Activepieces session workspace does not match the active workspace.',
        );
      }

      if (!input.automationId) {
        throw new AppHttpException(
          'INVALID_REQUEST',
          400,
          'Activepieces Canvas requires automation_id for Stage 17.5.',
          {
            projectId: input.projectId,
          },
        );
      }

      const modePreference = normalizeModePreference(input);
      const rateKey = `${actor.id}:${workspaceId}:${input.projectId}`;
      assertNotRateLimited(
        this.successfulWindows,
        rateKey,
        SUCCESS_SESSION_LIMIT,
      );
      assertNotRateLimited(this.failedWindows, rateKey, FAILED_SESSION_LIMIT);

      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: input.automationId,
        action: 'activepieces.session.requested',
        result: 'success',
        meta: traceMeta,
        metadata: {
          projectId: input.projectId,
          clientRoute: input.clientRoute,
          purpose: input.purpose,
          modePreference,
          returnBuilderConfig: input.returnBuilderConfig ?? false,
        },
      });

      const requestHash = hashCanonical({
        workspaceId,
        projectId: input.projectId,
        automationId: input.automationId,
        purpose: input.purpose,
        clientRoute: input.clientRoute,
        modePreference,
      });
      const idempotencyKey = normalizeOptionalString(
        meta.idempotencyKey ?? input.idempotencyKey ?? null,
      );
      const cacheKey = idempotencyKey
        ? `${workspaceId}:${actor.id}:${idempotencyKey}`
        : null;
      let cachedResponse: ActivepiecesSessionReadyWireResponse | null = null;

      if (idempotencyKey && cacheKey) {
        cachedResponse = this.readCachedSession(cacheKey, requestHash);
      }

      const [
        workspaceSecurity,
        resolvedAutomation,
        runtimeStatus,
        localKeysStatus,
      ] = await Promise.all([
        this.getWorkspaceSecurity(workspaceId),
        this.resolveInstalledAutomationForRoute(
          workspaceId,
          input.automationId,
          input.projectId,
        ),
        this.getRuntimeStatus(),
        Promise.resolve(this.localOwnerKeyVaultService.getSafeStatus()),
      ]);
      const initialAutomation = resolvedAutomation.automation;
      const automation = await this.ensureAutomationUsesCanonicalRuntimeIds({
        actor,
        access,
        workspaceId,
        automation: initialAutomation,
        projectId: input.projectId,
        traceId: traceMeta.traceId,
      });

      this.assertAutomationReady(automation, input.projectId);

      if (workspaceSecurity.incidentLockActive) {
        throw new AppHttpException(
          'INCIDENT_LOCK',
          423,
          'Activepieces Canvas is blocked while incident mode is active.',
        );
      }

      const piecesPolicy = this.piecesPolicyService.buildAutomationCanvasPolicy(
        {
          workspaceSecurity,
          automation,
        },
      );
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.pieces_policy.evaluated',
        result: 'success',
        meta: traceMeta,
        metadata: {
          piecesFilterType: piecesPolicy.piecesFilterType,
          piecesTags: piecesPolicy.piecesTags,
          policyHash: piecesPolicy.policyHash,
        },
      });

      const mappedRole = this.roleMapper.mapAutomationCanvasRole({
        access,
        readOnlySupported: true,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.role.mapped',
        result: 'success',
        meta: traceMeta,
        metadata: {
          role: mappedRole.role,
          permissions: mappedRole.permissions,
          downgradeReason: mappedRole.downgradeReason,
        },
      });

      const projectBinding = await this.identityBridge.ensureProjectBinding({
        workspaceId,
        actor,
        automation,
        piecesPolicy,
        routeProjectId: input.projectId,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.project.provisioned',
        result: 'success',
        meta: traceMeta,
        metadata: {
          externalProjectId: projectBinding.externalProjectId,
          activepiecesProjectId: projectBinding.activepiecesProjectId,
          projectId: input.projectId,
        },
      });

      const userBinding = await this.identityBridge.ensureUserBinding({
        workspaceId,
        actor,
        role: mappedRole.role,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.user.provisioned',
        result: 'success',
        meta: traceMeta,
        metadata: {
          externalUserId: userBinding.externalUserId,
          activepiecesUserId: userBinding.activepiecesUserId,
          role: userBinding.activepiecesRole,
        },
      });

      await this.identityBridge.ensureProjectMembership({
        workspaceId,
        projectBinding,
        userBinding,
        role: mappedRole.role,
        traceId: traceMeta.traceId,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.membership.provisioned',
        result: 'success',
        meta: traceMeta,
        metadata: {
          activepiecesProjectId: projectBinding.activepiecesProjectId,
          activepiecesUserId: userBinding.activepiecesUserId,
          role: mappedRole.role,
        },
      });

      const flowBinding = await this.flowProvisioningService.ensureFlowBinding({
        workspaceId,
        routeProjectId: input.projectId,
        automation,
        projectBinding,
        traceId: traceMeta.traceId,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'activepieces.flow.provisioned',
        result: 'success',
        meta: traceMeta,
        metadata: {
          activepiecesProjectId: flowBinding.activepiecesProjectId,
          activepiecesFlowId: flowBinding.activepiecesFlowId,
          activepiecesFlowVersionId: flowBinding.activepiecesFlowVersionId,
          syncStatus: flowBinding.syncStatus,
          syncHash: flowBinding.syncHash,
        },
      });

      const readiness = await this.canvasReadinessService.validate({
        workspaceId,
        projectId: input.projectId,
        automationId: automation.id,
        projectBinding,
        userBinding,
        flowBinding,
        repairAttempted: false,
        canonicalReplacementRoute: resolvedAutomation.canonicalReplacementRoute,
      });
      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        action: 'canvas.readiness.checked',
        result:
          readiness.status === 'ready' || readiness.status === 'repaired'
            ? 'success'
            : 'error',
        reasonCode:
          readiness.readiness_code === 'READY'
            ? undefined
            : readiness.readiness_code,
        meta: traceMeta,
        metadata: {
          projectId: input.projectId,
          status: readiness.status,
          readinessCode: readiness.readiness_code,
          readinessVersion: readiness.readiness_version,
          activepiecesProjectId: readiness.activepieces_project_id,
          activepiecesFlowId: readiness.activepieces_flow_id,
          activepiecesVersion: readiness.activepieces_version,
          embedSdkVersion: readiness.embed_sdk_version,
          checks: readiness.checks,
        },
      });

      if (readiness.status !== 'ready' && readiness.status !== 'repaired') {
        await this.auditWriter.record({
          actor,
          workspaceId,
          automationId: automation.id,
          action: 'canvas.session.blocked',
          result: readiness.status === 'unavailable' ? 'error' : 'denied',
          reasonCode: readiness.readiness_code,
          meta: traceMeta,
          metadata: {
            projectId: input.projectId,
            readinessVersion: readiness.readiness_version,
            checks: readiness.checks,
          },
        });
        return buildControlledReadinessFailureResponse(
          readiness,
          traceMeta.traceId,
        );
      }

      if (
        cachedResponse &&
        cachedResponse.open_check?.readiness_version ===
          readiness.readiness_version
      ) {
        return cachedResponse;
      }

      const ttlSeconds = clampTtl(workspaceSecurity.tokenTtlSeconds);
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
      const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
      const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);
      const jti = randomUUID();
      const sessionId = randomUUID();
      const sdkContainerId = `activepieces-canvas-${sessionId}`;
      const brand = buildActivepiecesBrand();
      const modeDecision = this.resolveMode(modePreference);
      const localKeysReadiness = resolveLocalKeysReadiness(localKeysStatus);
      const openCheck = this.canvasReadinessService.toOpenCheck(readiness);
      const jwt = await this.jwtSigner.issue({
        actor,
        access,
        externalUserId: userBinding.externalUserId,
        externalProjectId: projectBinding.externalProjectId,
        projectDisplayName: access.activeWorkspace?.name ?? automation.title,
        role: mappedRole.role,
        piecesPolicy,
        issuedAtSeconds,
        expiresAtSeconds,
        jti,
      });

      await this.storeSession({
        sessionId,
        workspaceId,
        actorId: actor.id,
        automation,
        input,
        mode: modeDecision.mode,
        issuedAt,
        expiresAt,
        ttlSeconds,
        requestHash,
        idempotencyKey,
        jwtTokenHash: jwt.tokenHash,
        jtiHash: jwt.jtiHash,
        externalProjectId: projectBinding.externalProjectId,
        externalUserId: userBinding.externalUserId,
        role: mappedRole.role,
        piecesPolicy,
        traceId: traceMeta.traceId,
        ipHash: meta.clientIp
          ? this.jwtSigner.hashRuntimeSecretScoped(meta.clientIp)
          : null,
        userAgentHash: meta.userAgent
          ? this.jwtSigner.hashRuntimeSecretScoped(meta.userAgent)
          : null,
      });

      const response: ActivepiecesSessionReadyWireResponse = {
        status: localKeysReadiness.status,
        readiness_code: localKeysReadiness.readinessCode,
        session_id: sessionId,
        mode: modeDecision.mode,
        issued_at: issuedAt.toISOString(),
        instance_url: modeDecision.instanceUrl,
        builder_url: buildActivepiecesBuilderUrl(
          modeDecision.instanceUrl,
          flowBinding.activepiecesFlowId,
        ),
        initial_route: buildActivepiecesInitialRoute(
          flowBinding.activepiecesFlowId,
        ),
        expected_route: buildActivepiecesInitialRoute(
          flowBinding.activepiecesFlowId,
        ),
        refresh_policy: ACTIVEPIECES_CANVAS_REFRESH_POLICY,
        jwt_token: jwt.jwtToken,
        expires_at: expiresAt.toISOString(),
        ttl_seconds: ttlSeconds,
        locale: 'ru',
        brand_display_name: this.env.ACTIVEPIECES_BRAND_DISPLAY_NAME,
        brand,
        role: mappedRole.role,
        permissions: mappedRole.permissions,
        pieces_policy: {
          pieces_filter_type: piecesPolicy.piecesFilterType,
          pieces_tags: piecesPolicy.piecesTags,
          policy_hash: piecesPolicy.policyHash,
        },
        sdk_config: {
          container_id: sdkContainerId,
          prefix: modeDecision.prefix,
          locale: 'ru',
          brand_display_name: this.env.ACTIVEPIECES_BRAND_DISPLAY_NAME,
          design_system: 'activepieces_like',
          navigation_sync: true,
          embedding: {
            container_id: sdkContainerId,
            locale: 'ru',
            builder: {
              disable_navigation: false,
              hide_flow_name: false,
              home_button_icon: 'logo',
            },
            dashboard: {
              hide_sidebar: false,
              hide_flows_page_navbar: false,
              hide_page_header: false,
            },
            hide_folders: false,
            hide_export_and_import_flow: false,
            hide_duplicate_flow: false,
            navigation_sync: true,
          },
        },
        design_system: 'activepieces_like',
        flow_binding: {
          automation_id: flowBinding.automationId,
          activepieces_project_id: flowBinding.activepiecesProjectId,
          activepieces_flow_id: flowBinding.activepiecesFlowId,
          activepieces_flow_version_id: flowBinding.activepiecesFlowVersionId,
          sync_status: flowBinding.syncStatus,
          sync_hash: flowBinding.syncHash,
        },
        runtime_status: runtimeStatus,
        open_check: openCheck,
        ...(localKeysReadiness.warnings.length > 0
          ? { warnings: localKeysReadiness.warnings }
          : {}),
        ai_test_policy: localKeysReadiness.aiTestPolicy,
        diagnostics: {
          trace_id: traceMeta.traceId,
          safe_to_show: true,
          ap_app: runtimeStatus.ap_app,
          ap_worker: runtimeStatus.ap_worker,
          local_owner_keys: localKeysStatus.status,
        },
      };

      if (cacheKey) {
        this.idempotencyCache.set(cacheKey, {
          requestHash,
          response,
          expiresAtMs: expiresAt.getTime(),
        });
      }
      incrementRateWindow(this.successfulWindows, rateKey);

      await this.auditWriter.record({
        actor,
        workspaceId,
        automationId: automation.id,
        sessionId,
        action: 'activepieces.session.issued',
        result: 'success',
        meta: traceMeta,
        metadata: {
          projectId: input.projectId,
          clientRoute: input.clientRoute,
          mode: modeDecision.mode,
          role: mappedRole.role,
          externalProjectId: projectBinding.externalProjectId,
          activepiecesProjectId: flowBinding.activepiecesProjectId,
          activepiecesFlowId: flowBinding.activepiecesFlowId,
          piecesFilterType: piecesPolicy.piecesFilterType,
          piecesTags: piecesPolicy.piecesTags,
          policyHash: piecesPolicy.policyHash,
          tokenHashPrefix: jwt.tokenHash.slice(0, 12),
          ttlSeconds,
        },
      });

      return response;
    } catch (error) {
      if (workspaceId) {
        incrementRateWindow(
          this.failedWindows,
          `${actor.id}:${workspaceId}:${input.projectId}`,
        );
      }

      if (error instanceof AppHttpException) {
        await this.auditWriter.record({
          actor,
          workspaceId,
          automationId: input.automationId,
          action: 'activepieces.session.denied',
          result: error.getStatus() === 403 ? 'denied' : 'error',
          reasonCode: error.code,
          meta: traceMeta,
          metadata: {
            projectId: input.projectId,
            clientRoute: input.clientRoute,
            statusCode: error.getStatus(),
          },
        });

        const controlledResponse = buildControlledSessionFailureResponse(
          error,
          traceMeta.traceId,
        );
        if (controlledResponse) {
          return controlledResponse;
        }
      }

      throw error;
    }
  }

  async getCanvasReadiness(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: {
      readonly projectId: string;
      readonly automationId: string;
    },
    meta: ActivepiecesSessionRequestMeta,
  ): Promise<ActivepiecesCanvasReadinessWireResponse> {
    const workspaceId = access.activeWorkspace?.id ?? null;
    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Active workspace is required to check Activepieces Canvas readiness.',
      );
    }

    if (this.env.ACTIVEPIECES_MVP_CANVAS_ENABLED === '0') {
      throw new AppHttpException(
        'FEATURE_DISABLED',
        503,
        'Activepieces Canvas is disabled.',
      );
    }

    const traceMeta = {
      ...meta,
      traceId: meta.traceId,
    };
    const [workspaceSecurity, resolvedAutomation] = await Promise.all([
      this.getWorkspaceSecurity(workspaceId),
      this.resolveInstalledAutomationForRoute(
        workspaceId,
        input.automationId,
        input.projectId,
      ),
    ]);
    const initialAutomation = resolvedAutomation.automation;
    const automation = await this.ensureAutomationUsesCanonicalRuntimeIds({
      actor,
      access,
      workspaceId,
      automation: initialAutomation,
      projectId: input.projectId,
      traceId: traceMeta.traceId,
    });

    this.assertAutomationReady(automation, input.projectId);

    if (workspaceSecurity.incidentLockActive) {
      throw new AppHttpException(
        'INCIDENT_LOCK',
        423,
        'Activepieces Canvas is blocked while incident mode is active.',
      );
    }

    const piecesPolicy = this.piecesPolicyService.buildAutomationCanvasPolicy({
      workspaceSecurity,
      automation,
    });
    const mappedRole = this.roleMapper.mapAutomationCanvasRole({
      access,
      readOnlySupported: true,
    });
    const projectBinding = await this.identityBridge.ensureProjectBinding({
      workspaceId,
      actor,
      automation,
      piecesPolicy,
      routeProjectId: input.projectId,
    });
    const userBinding = await this.identityBridge.ensureUserBinding({
      workspaceId,
      actor,
      role: mappedRole.role,
    });
    await this.identityBridge.ensureProjectMembership({
      workspaceId,
      projectBinding,
      userBinding,
      role: mappedRole.role,
      traceId: traceMeta.traceId,
    });
    const flowBinding = await this.flowProvisioningService.ensureFlowBinding({
      workspaceId,
      routeProjectId: input.projectId,
      automation,
      projectBinding,
      traceId: traceMeta.traceId,
    });
    const readiness = await this.canvasReadinessService.validate({
      workspaceId,
      projectId: input.projectId,
      automationId: automation.id,
      projectBinding,
      userBinding,
      flowBinding,
      repairAttempted: false,
      canonicalReplacementRoute: resolvedAutomation.canonicalReplacementRoute,
    });

    await this.auditWriter.record({
      actor,
      workspaceId,
      automationId: automation.id,
      action: 'canvas.readiness.checked',
      result:
        readiness.status === 'ready' || readiness.status === 'repaired'
          ? 'success'
          : 'error',
      reasonCode:
        readiness.readiness_code === 'READY'
          ? undefined
          : readiness.readiness_code,
      meta: traceMeta,
      metadata: {
        projectId: input.projectId,
        status: readiness.status,
        readinessCode: readiness.readiness_code,
        readinessVersion: readiness.readiness_version,
        activepiecesProjectId: readiness.activepieces_project_id,
        activepiecesFlowId: readiness.activepieces_flow_id,
        activepiecesVersion: readiness.activepieces_version,
        embedSdkVersion: readiness.embed_sdk_version,
        checks: readiness.checks,
      },
    });

    return readiness;
  }

  async initializeSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    sessionId: string,
    meta: ActivepiecesSessionRequestMeta,
  ): Promise<InitializeActivepiecesSessionWireResponse> {
    const workspaceId = access.activeWorkspace?.id ?? null;
    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Active workspace is required to initialize Activepieces Canvas.',
      );
    }

    const row = await this.databaseService.one<InitializedSessionRow>(
      `
        update app.activepieces_embed_sessions
        set
          initialized_at = coalesce(initialized_at, timezone('utc', now())),
          consumed_at = coalesce(consumed_at, timezone('utc', now())),
          status = 'initialized'
        where id = $1
          and workspace_id = $2
          and auth_user_id = $3
          and token_expires_at > timezone('utc', now())
        returning id, initialized_at::text, installed_automation_id
      `,
      [sessionId, workspaceId, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'SESSION_INVALID',
        404,
        'Activepieces session is expired or does not belong to this workspace.',
      );
    }

    await this.auditWriter.record({
      actor,
      workspaceId,
      automationId: row.installed_automation_id,
      sessionId: row.id,
      action: 'activepieces.session.initialized',
      result: 'success',
      meta,
      metadata: {
        initializedAt: row.initialized_at,
      },
    });

    return {
      status: 'initialized',
      session_id: row.id,
      initialized_at: row.initialized_at,
    };
  }

  async recordIframeHealth(
    actor: AuthenticatedActor,
    access: AccessContext,
    sessionId: string,
    input: Omit<RecordActivepiecesIframeHealthRequest, 'sessionId'>,
    meta: ActivepiecesSessionRequestMeta,
  ): Promise<RecordActivepiecesIframeHealthWireResponse> {
    const workspaceId = access.activeWorkspace?.id ?? null;
    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Active workspace is required to record Activepieces Canvas health.',
      );
    }

    const row = await this.databaseService.one<InitializedSessionRow>(
      `
        select
          id,
          coalesce(initialized_at, issued_at)::text as initialized_at,
          installed_automation_id
        from app.activepieces_embed_sessions
        where id = $1
          and workspace_id = $2
          and auth_user_id = $3
          and token_expires_at > timezone('utc', now())
        limit 1
      `,
      [sessionId, workspaceId, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'SESSION_INVALID',
        404,
        'Activepieces session is expired or does not belong to this workspace.',
      );
    }

    const recordedAt = new Date().toISOString();
    await this.auditWriter.record({
      actor,
      workspaceId,
      automationId: row.installed_automation_id,
      sessionId: row.id,
      action: `canvas.iframe.${input.event}`,
      result: activepiecesIframeHealthResult(input.event),
      reasonCode: activepiecesIframeHealthReasonCode(input.event),
      meta: {
        ...meta,
        traceId: input.clientTraceId ?? meta.traceId,
      },
      metadata: {
        event: input.event,
        details: input.details ?? {},
        recordedAt,
      },
    });

    return {
      status: 'recorded',
      session_id: row.id,
      event: input.event,
      recorded_at: recordedAt,
    };
  }

  async createManagedAuthnExternalToken(input: {
    readonly externalAccessToken: string;
  }) {
    const tokenHash = this.jwtSigner.hashRuntimeSecretScoped(
      input.externalAccessToken,
    );
    const session = await this.databaseService.one<ManagedAuthnSessionRow>(
      `
        select
          id,
          workspace_id,
          auth_user_id,
          installed_automation_id
        from app.activepieces_embed_sessions
        where token_hash = $1
          and token_expires_at > timezone('utc', now())
          and status in ('issued', 'initialized')
        order by issued_at desc
        limit 1
      `,
      [tokenHash],
    );

    if (!session) {
      throw new AppHttpException(
        'SESSION_INVALID',
        401,
        'Activepieces managed auth token is expired or unknown.',
      );
    }

    const binding = await this.databaseService.one<ManagedAuthnBindingRow>(
      `
        select
          ub.ap_user_id,
          ub.external_user_id,
          pb.ap_project_id,
          p.email,
          p.full_name
        from app.activepieces_user_bindings ub
        join app.activepieces_project_bindings pb
          on pb.workspace_id = ub.workspace_id
        left join app.profiles p
          on p.id = ub.auth_user_id
        where ub.workspace_id = $1
          and ub.auth_user_id = $2
        limit 1
      `,
      [session.workspace_id, session.auth_user_id],
    );

    if (!binding?.ap_user_id || !binding.ap_project_id) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Activepieces managed auth binding is not provisioned.',
      );
    }

    const apJwtSecret = process.env.AP_JWT_SECRET?.trim();
    if (!apJwtSecret) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Activepieces JWT secret is unavailable for managed auth compatibility.',
      );
    }

    const token = await new SignJWT({
      id: binding.ap_user_id,
      type: 'USER',
      projectId: binding.ap_project_id,
      platform: {
        id: STAGE17_ACTIVEPIECES_PLATFORM_ID,
      },
      tokenVersion: 'stage17',
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
        kid: '1',
      })
      .setIssuer('activepieces')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(apJwtSecret));

    const nameParts = splitDisplayName(binding.full_name);
    return {
      id: binding.ap_user_id,
      platformRole: 'ADMIN',
      status: 'ACTIVE',
      externalId: binding.external_user_id,
      platformId: STAGE17_ACTIVEPIECES_PLATFORM_ID,
      verified: true,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: binding.email ?? 'stage17.owner@lexframe.test',
      trackEvents: false,
      newsLetter: false,
      token,
      projectId: binding.ap_project_id,
    };
  }

  private async getWorkspaceSecurity(
    workspaceId: string,
  ): Promise<ActivepiecesWorkspaceSecurityForSession> {
    const row = await this.databaseService.one<WorkspaceSecurityRow>(
      `
        select
          workspace_id,
          token_ttl_seconds,
          pieces_filter_type,
          pieces_tags,
          incident_lock_active
        from app.activepieces_workspace_security
        where workspace_id = $1
        limit 1
      `,
      [workspaceId],
    );

    return {
      workspaceId,
      incidentLockActive: row?.incident_lock_active ?? false,
      tokenTtlSeconds: row?.token_ttl_seconds ?? 120,
      piecesFilterType: row?.pieces_filter_type ?? 'ALLOWED',
      piecesTags: row?.pieces_tags ?? [],
    };
  }

  private async getInstalledAutomation(
    workspaceId: string,
    automationId: string,
  ): Promise<ActivepiecesInstalledAutomationForSession> {
    const row = await this.getInstalledAutomationRow(workspaceId, automationId);

    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_ACCESS_DENIED',
        403,
        'Automation does not belong to the active workspace.',
      );
    }

    return row;
  }

  private async resolveInstalledAutomationForRoute(
    workspaceId: string,
    automationId: string,
    routeProjectId: string,
  ): Promise<ResolvedAutomationForSession> {
    const exact = await this.getInstalledAutomationRow(
      workspaceId,
      automationId,
    );
    if (exact) {
      return {
        automation: exact,
        canonicalReplacementRoute: null,
      };
    }

    const canonical = await this.getCanonicalInstalledAutomation(workspaceId);
    if (!canonical) {
      throw new AppHttpException(
        'AUTOMATION_ACCESS_DENIED',
        403,
        'Automation does not belong to the active workspace.',
      );
    }

    return {
      automation: canonical,
      canonicalReplacementRoute: buildProjectAutomationRoute(
        routeProjectId,
        canonical.id,
      ),
    };
  }

  private async getInstalledAutomationRow(
    workspaceId: string,
    automationId: string,
  ): Promise<ActivepiecesInstalledAutomationForSession | null> {
    return this.databaseService.one<ActivepiecesInstalledAutomationForSession>(
      `
        select
          id,
          workspace_id,
          template_id,
          source_template_version_id,
          title,
          version,
          workflow_state,
          builder_state,
          sync_state,
          compatibility_status,
          available,
          workflow,
          active_canvas_version_id,
          production_disabled_at,
          production_disabled_reason,
          runtime_project_id,
          runtime_flow_id,
          sync_hash
        from app.installed_automations
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  private async getCanonicalInstalledAutomation(
    workspaceId: string,
  ): Promise<ActivepiecesInstalledAutomationForSession | null> {
    const result =
      await this.databaseService.query<ActivepiecesInstalledAutomationForSession>(
        `
          select
            id,
            workspace_id,
            template_id,
            source_template_version_id,
            title,
            version,
            workflow_state,
            builder_state,
            sync_state,
            compatibility_status,
            available,
            workflow,
            active_canvas_version_id,
            production_disabled_at,
            production_disabled_reason,
            runtime_project_id,
            runtime_flow_id,
            sync_hash
          from app.installed_automations
          where workspace_id = $1
            and deleted_at is null
            and available = true
            and builder_state = 'ready'
            and sync_state = 'synced'
            and compatibility_status <> 'policy_blocked'
          order by
            case when sync_hash = $2 then 0 else 1 end,
            updated_at desc
          limit 2
        `,
        [workspaceId, ACTIVEPIECES_CANVAS_CANONICAL_SYNC_HASH],
      );
    const rows = result.rows;
    const candidate = rows[0] ?? null;
    if (!candidate) {
      return null;
    }
    if (
      candidate.sync_hash === ACTIVEPIECES_CANVAS_CANONICAL_SYNC_HASH ||
      rows.length === 1
    ) {
      return candidate;
    }
    return null;
  }

  private assertAutomationReady(
    automation: ActivepiecesInstalledAutomationForSession,
    routeProjectId: string,
  ) {
    if (!automation.available || automation.production_disabled_at) {
      throw new AppHttpException(
        'AUTOMATION_ACCESS_DENIED',
        403,
        'Automation is not available for Activepieces Canvas.',
        {
          automationId: automation.id,
          projectId: routeProjectId,
        },
      );
    }

    if (
      automation.builder_state !== 'ready' ||
      automation.sync_state !== 'synced' ||
      automation.compatibility_status === 'policy_blocked'
    ) {
      throw new AppHttpException(
        'ACTIVEPIECES_BINDING_BROKEN',
        409,
        'Automation runtime binding is not ready for Activepieces Canvas.',
        {
          automationId: automation.id,
          projectId: routeProjectId,
          builderState: automation.builder_state,
          syncState: automation.sync_state,
          compatibilityStatus: automation.compatibility_status,
        },
      );
    }
  }

  private async ensureAutomationUsesCanonicalRuntimeIds(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly workspaceId: string;
    readonly automation: ActivepiecesInstalledAutomationForSession;
    readonly projectId: string;
    readonly traceId: string | null;
  }): Promise<ActivepiecesInstalledAutomationForSession> {
    if (hasCanonicalActivepiecesRuntimeIds(input.automation)) {
      return input.automation;
    }

    await this.auditWriter.record({
      actor: input.actor,
      workspaceId: input.workspaceId,
      automationId: input.automation.id,
      action: 'canvas.readiness.repaired',
      result: 'success',
      reasonCode: 'AP_MANAGED_AUTH_FAILED',
      meta: {
        requestId: null,
        traceId: input.traceId,
      },
      metadata: {
        projectId: input.projectId,
        repair: 'canonical_activepieces_runtime_ids',
        runtimeProjectId: input.automation.runtime_project_id,
        runtimeFlowId: input.automation.runtime_flow_id,
        activeCanvasVersionId: input.automation.active_canvas_version_id,
      },
    });

    await this.canvasProvisioningService.ensureStage17Canvas({
      actor: input.actor,
      access: input.access,
      projectId: input.projectId,
      traceId: input.traceId,
    });

    return this.getInstalledAutomation(input.workspaceId, input.automation.id);
  }

  private async getRuntimeStatus(): Promise<
    ActivepiecesSessionReadyWireResponse['runtime_status']
  > {
    if (this.env.LEXFRAME_STAGE17_READINESS_ENABLED !== '1') {
      return {
        ap_app: 'ok',
        ap_worker: 'unknown',
        ap_db: 'unknown',
        redis: 'unknown',
      };
    }

    const flagsUrl = `${this.env.ACTIVEPIECES_BASE_URL.replace(
      /\/$/,
      '',
    )}/api/v1/flags`;
    let lastError: unknown = null;

    for (
      let attempt = 1;
      attempt <= ACTIVEPIECES_RUNTIME_PROBE_ATTEMPTS;
      attempt += 1
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        ACTIVEPIECES_RUNTIME_PROBE_TIMEOUT_MS,
      );

      try {
        const response = await fetch(flagsUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Activepieces readiness returned ${response.status}`);
        }

        return {
          ap_app: 'ok',
          ap_worker: this.env.ACTIVEPIECES_WORKER_HEALTH_URL
            ? 'ok'
            : 'degraded',
          ap_db: 'ok',
          redis: 'ok',
        };
      } catch (error) {
        lastError = error;
        if (attempt < ACTIVEPIECES_RUNTIME_PROBE_ATTEMPTS) {
          await waitForRuntimeProbeRetry(
            ACTIVEPIECES_RUNTIME_PROBE_RETRY_DELAY_MS * attempt,
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new AppHttpException(
      'ACTIVEPIECES_RUNTIME_UNAVAILABLE',
      503,
      'Activepieces runtime readiness could not be verified.',
      {
        reason: describeRuntimeProbeError(lastError),
      },
    );
  }

  private resolveMode(
    modePreference: ActivepiecesSessionPreferredMode,
  ): ActivepiecesModeDecision {
    const instanceUrl = this.env.ACTIVEPIECES_PUBLIC_URL.replace(/\/$/, '');
    const parsed = new URL(instanceUrl);
    const prefix = parsed.pathname === '/' ? '' : parsed.pathname;

    return {
      mode:
        modePreference === 'reverse_proxy' ? 'reverse_proxy' : 'iframe_embed',
      instanceUrl,
      prefix,
    };
  }

  private readCachedSession(
    cacheKey: string,
    requestHash: string,
  ): ActivepiecesSessionReadyWireResponse | null {
    const cached = this.idempotencyCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAtMs <= Date.now()) {
      this.idempotencyCache.delete(cacheKey);
      return null;
    }

    if (cached.requestHash !== requestHash) {
      throw new AppHttpException(
        'INVALID_CLIENT_FIELD',
        409,
        'Idempotency key was reused with a different Activepieces session request.',
      );
    }

    return cached.response;
  }

  private async storeSession(input: {
    readonly sessionId: string;
    readonly workspaceId: string;
    readonly actorId: string;
    readonly automation: ActivepiecesInstalledAutomationForSession;
    readonly input: CreateActivepiecesSessionRequest;
    readonly mode: ActivepiecesModeDecision['mode'];
    readonly issuedAt: Date;
    readonly expiresAt: Date;
    readonly ttlSeconds: number;
    readonly requestHash: string;
    readonly idempotencyKey: string | null;
    readonly jwtTokenHash: string;
    readonly jtiHash: string;
    readonly externalProjectId: string;
    readonly externalUserId: string;
    readonly role: 'EDITOR' | 'VIEWER';
    readonly piecesPolicy: {
      readonly piecesFilterType: 'ALLOWED';
      readonly piecesTags: readonly string[];
      readonly policyHash: string;
    };
    readonly traceId: string | null;
    readonly ipHash: string | null;
    readonly userAgentHash: string | null;
  }) {
    await this.databaseService.query(
      `
        insert into app.activepieces_embed_sessions (
          id,
          session_id,
          workspace_id,
          installed_automation_id,
          auth_user_id,
          purpose,
          token_hash,
          token_expires_at,
          external_project_id,
          external_user_id,
          jti_hash,
          canvas_role,
          issued_for_automation_id,
          issued_for_version_id,
          issued_reason,
          role,
          pieces_filter_type,
          pieces_tags,
          trace_id,
          mode,
          project_id,
          pieces_policy_hash,
          issued_at,
          ttl_seconds,
          status,
          request_hash,
          idempotency_key,
          ip_hash,
          user_agent_hash
        )
        values (
          $1,
          $1,
          $2,
          $3,
          $4,
          'automation_canvas',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $3,
          $11,
          'automation_canvas',
          $10,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          'issued',
          $20,
          $21,
          $22,
          $23
        )
      `,
      [
        input.sessionId,
        input.workspaceId,
        input.automation.id,
        input.actorId,
        input.jwtTokenHash,
        input.expiresAt.toISOString(),
        input.externalProjectId,
        input.externalUserId,
        input.jtiHash,
        input.role,
        input.automation.active_canvas_version_id,
        input.piecesPolicy.piecesFilterType,
        [...input.piecesPolicy.piecesTags],
        input.traceId,
        input.mode,
        input.input.projectId,
        input.piecesPolicy.policyHash,
        input.issuedAt.toISOString(),
        input.ttlSeconds,
        input.requestHash,
        input.idempotencyKey,
        input.ipHash,
        input.userAgentHash,
      ],
    );
  }
}

interface RateWindow {
  readonly startedAtMs: number;
  count: number;
}

function normalizeModePreference(input: CreateActivepiecesSessionRequest) {
  return input.modePreference ?? input.preferredMode ?? 'auto';
}

function clampTtl(value: number) {
  return Math.max(60, Math.min(Number.isFinite(value) ? value : 120, 300));
}

function hasCanonicalActivepiecesRuntimeIds(
  automation: ActivepiecesInstalledAutomationForSession,
) {
  return (
    isCanonicalActivepiecesId(automation.runtime_project_id) &&
    isCanonicalActivepiecesId(automation.runtime_flow_id) &&
    isCanonicalActivepiecesId(automation.active_canvas_version_id) &&
    automation.sync_hash === ACTIVEPIECES_CANVAS_CANONICAL_SYNC_HASH
  );
}

function isCanonicalActivepiecesId(value: string | null | undefined) {
  return (
    typeof value === 'string' &&
    /^[0-9a-zA-Z]{21}$/.test(value) &&
    !value.startsWith('lfstg17')
  );
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function waitForRuntimeProbeRetry(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function describeRuntimeProbeError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'activepieces_runtime_unavailable';
  }

  return error.message || error.name || 'activepieces_runtime_unavailable';
}

function buildActivepiecesBuilderUrl(
  instanceUrl: string,
  runtimeFlowId: string | null,
) {
  if (!runtimeFlowId) {
    return instanceUrl;
  }

  return `${instanceUrl}/flows/${encodeURIComponent(runtimeFlowId)}`;
}

function buildActivepiecesInitialRoute(runtimeFlowId: string | null) {
  if (!runtimeFlowId) {
    return '/flows';
  }

  return `/flows/${encodeURIComponent(runtimeFlowId)}`;
}

function buildActivepiecesBrand() {
  return {
    short_name: 'Автоматизация',
    long_name: 'Конструктор автоматизаций',
    document_title: 'Конструктор автоматизаций',
    logo_alt: 'Автоматизация',
    aria_label: 'Конструктор автоматизаций',
  } as const;
}

function splitDisplayName(fullName: string | null) {
  const fallback = {
    firstName: 'LexFrame',
    lastName: 'Stage17',
  };
  const value = fullName?.trim();
  if (!value) {
    return fallback;
  }

  const [firstName, ...rest] = value.split(/\s+/);
  return {
    firstName: firstName || fallback.firstName,
    lastName: rest.join(' ') || fallback.lastName,
  };
}

function resolveLocalKeysReadiness(status: SafeLocalKeysStatus): {
  readonly status: 'ready' | 'degraded';
  readonly readinessCode: AutomationCanvasReadinessCode;
  readonly warnings: NonNullable<
    ActivepiecesSessionReadyWireResponse['warnings']
  >;
  readonly aiTestPolicy: NonNullable<
    ActivepiecesSessionReadyWireResponse['ai_test_policy']
  >;
} {
  if (status.status === 'ready') {
    return {
      status: 'ready',
      readinessCode: 'READY',
      warnings: [],
      aiTestPolicy: {
        status: 'ok',
        block_required_ai_tests: false,
        allow_non_ai_canvas_editing: true,
      },
    };
  }

  const invalid = status.status === 'invalid';
  return {
    status: 'degraded',
    readinessCode: invalid ? 'LOCAL_KEYS_INVALID' : 'LOCAL_OWNER_KEYS_MISSING',
    warnings: [
      {
        code: invalid ? 'LOCAL_KEYS_INVALID' : 'LOCAL_OWNER_KEYS_MISSING',
        severity: 'warning',
        title: invalid
          ? 'Локальные AI-ключи некорректны'
          : 'Локальные AI-ключи не найдены',
        message: invalid
          ? 'Canvas доступен, но AI-тесты и обязательные AI-запуски заблокированы до исправления Local Owner Key Vault.'
          : 'Canvas доступен, но AI-тесты и обязательные AI-запуски будут заблокированы до настройки Local Owner Key Vault.',
      },
    ],
    aiTestPolicy: {
      status: 'warning',
      block_required_ai_tests: true,
      allow_non_ai_canvas_editing: true,
    },
  };
}

function buildControlledSessionFailureResponse(
  error: AppHttpException,
  traceId: string | null,
): ActivepiecesSessionWireResponse | null {
  const code = String(error.code);
  const readinessCode = mapSessionErrorToReadinessCode(code);
  if (!readinessCode) {
    return null;
  }

  const baseResponse = {
    readiness_code: readinessCode,
    jwt_token: null,
    expires_at: null,
    role: null,
    message: messageForReadiness(readinessCode),
    fallback: {
      show_builder_unavailable_state: true,
      allow_lexframe_canvas_reserve: true,
      allow_runs_tab: true,
      allow_settings_tab: true,
      allow_diagnostics_tab: true,
    },
    open_check: buildOpenCheck({
      status: 'blocked',
      reasonCode: readinessCode,
      activepiecesProjectId: null,
      activepiecesFlowId: null,
      repairAttempted: false,
      checkedAt: new Date(),
    }),
    diagnostics: {
      trace_id: traceId,
      safe_to_show: true,
    },
  } as const;

  if (
    readinessCode === 'ACTIVEPIECES_UNAVAILABLE' ||
    readinessCode === 'SESSION_BRIDGE_UNAVAILABLE'
  ) {
    return {
      status: 'unavailable',
      ...baseResponse,
    };
  }

  return {
    status: 'blocked',
    ...baseResponse,
  };
}

function buildControlledReadinessFailureResponse(
  readiness: ActivepiecesCanvasReadinessWireResponse,
  traceId: string | null,
): ActivepiecesSessionWireResponse {
  const response = {
    readiness_code: readiness.readiness_code,
    jwt_token: null,
    expires_at: null,
    role: null,
    message: readiness.message ?? messageForReadiness(readiness.readiness_code),
    fallback: {
      show_builder_unavailable_state: true,
      allow_lexframe_canvas_reserve: true,
      allow_runs_tab: true,
      allow_settings_tab: true,
      allow_diagnostics_tab: true,
    },
    open_check: readiness,
    diagnostics: {
      trace_id: traceId,
      safe_to_show: true,
    },
  } as const;

  return readiness.status === 'unavailable'
    ? {
        status: 'unavailable',
        ...response,
      }
    : {
        status: 'blocked',
        ...response,
      };
}

function buildOpenCheck(input: {
  readonly status: 'ready' | 'repaired' | 'blocked' | 'unavailable';
  readonly reasonCode: AutomationCanvasReadinessCode;
  readonly activepiecesProjectId: string | null;
  readonly activepiecesFlowId: string | null;
  readonly repairAttempted: boolean;
  readonly checkedAt: Date;
}) {
  return {
    status: input.status,
    reason_code: input.reasonCode,
    activepieces_project_id: input.activepiecesProjectId,
    activepieces_flow_id: input.activepiecesFlowId,
    expected_route: buildActivepiecesInitialRoute(input.activepiecesFlowId),
    refresh_policy: ACTIVEPIECES_CANVAS_REFRESH_POLICY,
    repair_attempted: input.repairAttempted,
    checked_at: input.checkedAt.toISOString(),
  } as const;
}

function activepiecesIframeHealthResult(
  event: RecordActivepiecesIframeHealthRequest['event'],
): 'success' | 'error' {
  return event === 'ready' || event === 'recovered' ? 'success' : 'error';
}

function activepiecesIframeHealthReasonCode(
  event: RecordActivepiecesIframeHealthRequest['event'],
): AutomationCanvasReadinessCode | undefined {
  switch (event) {
    case 'stuck_loading':
      return 'AP_IFRAME_NAVIGATION_FAILED';
    case 'invalid_access':
      return 'PERMISSION_DENIED';
    default:
      return undefined;
  }
}

function mapSessionErrorToReadinessCode(
  code: string,
): AutomationCanvasReadinessCode | null {
  switch (code) {
    case 'FEATURE_DISABLED':
      return 'FEATURE_DISABLED';
    case 'WORKSPACE_ACCESS_DENIED':
    case 'PROJECT_ACCESS_DENIED':
    case 'AUTOMATION_ACCESS_DENIED':
    case 'ROLE_NOT_ALLOWED':
      return 'PERMISSION_DENIED';
    case 'ACTIVEPIECES_RUNTIME_UNAVAILABLE':
    case 'ACTIVEPIECES_UNAVAILABLE':
      return 'ACTIVEPIECES_UNAVAILABLE';
    case 'ACTIVEPIECES_VERSION_MISMATCH':
      return 'ACTIVEPIECES_VERSION_MISMATCH';
    case 'AP_PROJECT_MISSING':
      return 'AP_PROJECT_MISSING';
    case 'AP_USER_MISSING':
      return 'AP_USER_MISSING';
    case 'AP_PROJECT_MEMBERSHIP_MISSING':
      return 'AP_PROJECT_MEMBERSHIP_MISSING';
    case 'AP_FLOW_MISSING':
      return 'AP_FLOW_MISSING';
    case 'AP_FLOW_PROJECT_MISMATCH':
      return 'AP_FLOW_PROJECT_MISMATCH';
    case 'AP_MANAGED_AUTH_FAILED':
      return 'AP_MANAGED_AUTH_FAILED';
    case 'AP_WEBSOCKET_UNAVAILABLE':
      return 'AP_WEBSOCKET_UNAVAILABLE';
    case 'AP_IFRAME_NAVIGATION_FAILED':
      return 'AP_IFRAME_NAVIGATION_FAILED';
    case 'ACTIVEPIECES_BINDING_BROKEN':
    case 'FLOW_BINDING_MISSING':
    case 'READINESS_GATE_BLOCKED':
      return 'FLOW_BINDING_MISSING';
    case 'SESSION_BRIDGE_UNAVAILABLE':
    case 'SESSION_INVALID':
      return 'SESSION_BRIDGE_UNAVAILABLE';
    default:
      return null;
  }
}

function messageForReadiness(code: AutomationCanvasReadinessCode) {
  switch (code) {
    case 'ACTIVEPIECES_VERSION_MISMATCH':
      return 'ActivePieces runtime and embed SDK versions are incompatible.';
    case 'AP_PROJECT_MISSING':
      return 'ActivePieces project is missing.';
    case 'AP_USER_MISSING':
      return 'ActivePieces user is missing.';
    case 'AP_PROJECT_MEMBERSHIP_MISSING':
      return 'ActivePieces project membership is missing.';
    case 'AP_FLOW_MISSING':
      return 'ActivePieces flow or flow version is missing.';
    case 'AP_FLOW_PROJECT_MISMATCH':
      return 'ActivePieces flow belongs to another project.';
    case 'AP_WEBSOCKET_UNAVAILABLE':
      return 'ActivePieces websocket endpoint is unavailable.';
    case 'AP_MANAGED_AUTH_FAILED':
      return 'ActivePieces managed authentication failed.';
    case 'AP_IFRAME_NAVIGATION_FAILED':
      return 'ActivePieces iframe did not open the requested flow.';
    case 'ACTIVEPIECES_UNAVAILABLE':
      return 'Конструктор автоматизаций временно недоступен.';
    case 'SESSION_BRIDGE_UNAVAILABLE':
      return 'Не удалось подготовить защищённую сессию конструктора.';
    case 'FLOW_BINDING_MISSING':
      return 'Для этой автоматизации ещё не подготовлена runtime-связь.';
    case 'FEATURE_DISABLED':
      return 'Canvas автоматизаций отключён в этом окружении.';
    case 'PERMISSION_DENIED':
      return 'У вас нет доступа к Canvas этой автоматизации.';
    default:
      return 'Конструктор автоматизаций временно недоступен.';
  }
}

function buildProjectAutomationRoute(projectId: string, automationId: string) {
  return `/app/projects/${encodeURIComponent(
    projectId,
  )}/automations/${encodeURIComponent(automationId)}/automation`;
}

function hashCanonical(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function incrementRateWindow(store: Map<string, RateWindow>, key: string) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now - existing.startedAtMs > RATE_LIMIT_WINDOW_MS) {
    store.set(key, {
      startedAtMs: now,
      count: 1,
    });
    return;
  }

  existing.count += 1;
}

function assertNotRateLimited(
  store: Map<string, RateWindow>,
  key: string,
  limit: number,
) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing) {
    return;
  }

  if (now - existing.startedAtMs > RATE_LIMIT_WINDOW_MS) {
    store.delete(key);
    return;
  }

  if (existing.count >= limit) {
    throw new AppHttpException(
      'SESSION_RATE_LIMITED',
      429,
      'Activepieces session request rate limit exceeded.',
    );
  }
}
