import type {
  ActivepiecesIntegrationStatus,
  ActivepiecesWorkspaceSecurityState,
  ActivepiecesEmbedTokenResponse,
  ActivepiecesRunSmokeRequest,
  ActivepiecesRunSmokeResponse,
  ActivepiecesRunEventCallback,
  ActivepiecesStepEventCallback,
  AutomationRuntimeRequirements,
  CreateActivepiecesEmbedTokenRequest,
  CreateRunArtifactRequest,
  LexFrameWorkflowV2,
  RuntimeConnectionSummary,
  RuntimePieceRequirement,
  RuntimeApprovalGateCallback,
  RuntimeDeliveryGateCallback,
  StartAutomationRunRequest,
  StartAutomationRunResponse,
  SyncAutomationRuntimeRequest,
  SyncAutomationRuntimeResponse,
  UpsertRuntimeConnectionRequest,
} from '@lexframe/contracts';
import { activepiecesSmokeFlows } from '@lexframe/activepieces-legal-pieces';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { DeliveryService } from '../delivery/delivery.service';
import { DocumentsService } from '../documents/documents.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { CanvasValidationService } from '../canvas/canvas-validation.service';
import { WorkflowCompilerService } from '../workflow-compiler/workflow-compiler.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface InstalledAutomationRuntimeRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly template_id: string;
  readonly source_template_version_id: string;
  readonly title: string;
  readonly version: string;
  readonly workflow_state:
    | 'draft'
    | 'published'
    | 'compiled'
    | 'execution_ready';
  readonly builder_state: 'unavailable' | 'mock' | 'ready';
  readonly sync_state:
    | 'not_requested'
    | 'pending'
    | 'synced'
    | 'failed'
    | 'disabled';
  readonly compatibility_status:
    | 'compatible'
    | 'runtime_sync_pending'
    | 'missing_requirements'
    | 'policy_blocked';
  readonly available: boolean;
  readonly disabled_reason: string | null;
  readonly required_inputs: readonly string[] | null;
  readonly requirements: readonly RequirementRecord[] | null;
  readonly workflow: Record<string, unknown> | null;
  readonly active_canvas_version_id: string | null;
  readonly production_disabled_at: string | null;
  readonly production_disabled_reason: string | null;
  readonly next_gate: string;
  readonly runtime_project_id: string | null;
  readonly runtime_flow_id: string | null;
  readonly sync_hash: string | null;
  readonly last_synced_at: string | null;
}

interface RequirementRecord {
  readonly code: string;
  readonly label: string;
  readonly kind:
    | 'document'
    | 'profile'
    | 'connection'
    | 'approval'
    | 'permission';
  readonly description: string;
  readonly status: 'ready' | 'missing' | 'blocked';
  readonly optional: boolean;
  readonly sourceDocumentId: string | null;
}

interface RuntimeConnectionRow {
  readonly id: string;
  readonly code: string;
  readonly provider: string;
  readonly display_name: string;
  readonly scope: 'workspace' | 'predefined';
  readonly status: 'connected' | 'missing' | 'error' | 'revoked';
  readonly external_connection_name: string | null;
  readonly last_checked_at: string | null;
}

interface RuntimeBindingRow {
  readonly id: string;
  readonly installed_automation_id: string;
  readonly automation_version_id: string | null;
  readonly runtime_projection_id: string | null;
  readonly external_project_id: string;
  readonly external_flow_id: string;
  readonly sync_hash: string;
  readonly status: 'pending' | 'synced' | 'failed';
  readonly last_synced_at: string | null;
}

interface WorkflowRunRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly installed_automation_id: string;
  readonly trace_id: string;
  readonly external_run_id: string | null;
  readonly approval_state: 'not_required' | 'pending' | 'approved' | 'rejected';
  readonly created_by_user_id: string | null;
}

interface WorkflowRunBindingRow {
  readonly workflow_run_id: string;
  readonly workspace_id: string;
  readonly callback_token_hash: string;
}

interface ActivepiecesWorkspaceSecurityRow {
  readonly workspace_id: string;
  readonly builder_admin_allowed: boolean;
  readonly sandbox_required: boolean;
  readonly event_streaming_enabled: boolean;
  readonly signing_key_configured: boolean;
  readonly token_ttl_seconds: number;
  readonly pieces_filter_type: string;
  readonly pieces_tags: readonly string[] | null;
  readonly incident_lock_active: boolean;
}

interface ActivepiecesProjectResponse {
  readonly id: string;
  readonly externalId?: string;
}

interface ActivepiecesListResponse<T> {
  readonly data?: readonly T[];
}

interface ActivepiecesFlowResponse {
  readonly id: string;
}

interface ActivepiecesApiProbeResult {
  readonly reachable: boolean;
  readonly summary: string;
  readonly projectCount?: number;
}

interface ActivepiecesCredentialContext {
  readonly projectId: string | null;
  readonly platformId: string | null;
  readonly tokenType: 'service-key' | 'jwt' | 'unknown';
}

interface WorkflowRunStatusRow {
  readonly status: StartAutomationRunResponse['status'];
  readonly trace_id: string;
}

interface RunSmokeSummaryRow {
  readonly status: ActivepiecesRunSmokeResponse['status'];
  readonly external_run_id: string | null;
  readonly artifact_refs: readonly string[] | null;
}

interface CallbackReceiptSummaryRow {
  readonly callback_type: string;
  readonly receipt_count: string | number;
  readonly processed_count: string | number;
}

@Injectable()
export class ActivepiecesService {
  private readonly env = loadServerEnv();
  private readonly canvasValidationService = new CanvasValidationService();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly documentsService: DocumentsService,
    private readonly approvalsService: ApprovalsService,
    private readonly deliveryService: DeliveryService,
    private readonly liveEventsService: LiveEventsService,
    @Optional()
    private readonly workflowCompilerService?: WorkflowCompilerService,
  ) {}

  async getAutomationRuntimeRequirements(
    access: AccessContext,
    automationId: string,
  ): Promise<AutomationRuntimeRequirements> {
    const automation = await this.getInstalledAutomation(
      access.activeWorkspace!.id,
      automationId,
    );
    const connectionState = await this.resolveConnectionState(
      access.activeWorkspace!.id,
      automation,
      automationId,
    );
    const requiredPieces = this.deriveRequiredPieces(automation.workflow);
    const canvasValidation = isCanvasWorkflowLike(automation.workflow)
      ? this.canvasValidationService.runtimeGateValidate(automation.workflow)
      : null;
    const warnings = [
      ...this.buildRuntimeWarnings(
        automation,
        connectionState.missing,
        requiredPieces,
      ),
      ...(canvasValidation?.issues
        .filter(
          (issue) =>
            issue.severity === 'warning' ||
            issue.blocks?.includes('run') ||
            issue.blocks?.includes('compile'),
        )
        .map((issue) => `${issue.code}: ${issue.title}`) ?? []),
    ];
    const canOpenBuilder =
      automation.available &&
      !automation.production_disabled_at &&
      automation.sync_state === 'synced' &&
      automation.builder_state === 'ready' &&
      automation.compatibility_status !== 'policy_blocked';
    const canRun =
      canOpenBuilder &&
      !automation.production_disabled_at &&
      connectionState.missing.length === 0 &&
      (canvasValidation?.can_run ?? true);

    return {
      automationId: automation.id,
      canOpenBuilder,
      canRun,
      builderState: automation.builder_state,
      syncState: automation.sync_state,
      runtimeProjectId: automation.runtime_project_id,
      runtimeFlowId: automation.runtime_flow_id,
      missingConnections: connectionState.missing,
      availableConnections: connectionState.available,
      requiredPieces,
      warnings: [
        ...warnings,
        ...(automation.production_disabled_at
          ? [
              automation.production_disabled_reason ??
                'Automation production runs are emergency-disabled.',
            ]
          : []),
      ],
    };
  }

  async createEmbedToken(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateActivepiecesEmbedTokenRequest,
    meta: RequestMeta,
  ): Promise<ActivepiecesEmbedTokenResponse> {
    const workspaceSecurity = await this.getWorkspaceSecurityOverview(access);

    if (workspaceSecurity.incidentLockActive) {
      throw new AppHttpException(
        'INCIDENT_LOCK',
        423,
        'Activepieces builder access is blocked while incident mode is active.',
      );
    }

    const automation = await this.getInstalledAutomation(
      access.activeWorkspace!.id,
      input.installedAutomationId,
    );
    const requirements = await this.getAutomationRuntimeRequirements(
      access,
      automation.id,
    );

    if (!requirements.canOpenBuilder) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Automation runtime requirements are not satisfied for builder access.',
      );
    }

    const projectBinding = await this.ensureProjectBinding(
      access.activeWorkspace!.id,
      actor,
      automation,
    );
    const role =
      access.permissions.includes('canvas.open_advanced_builder') &&
      access.permissions.includes('activepieces.open_builder')
        ? 'builder'
        : 'viewer';
    const userBinding = await this.ensureUserBinding(
      access.activeWorkspace!.id,
      actor,
      role === 'builder' ? 'EDITOR' : 'VIEWER',
    );
    const piecesTags = this.derivePiecesTags(automation.workflow);
    const issuedAt = Math.floor(Date.now() / 1000);
    const tokenTtlSeconds = Math.max(
      60,
      Math.min(workspaceSecurity.tokenTtlSeconds, 300),
    );
    const expiresAt = new Date(Date.now() + tokenTtlSeconds * 1000);
    const jti = randomUUID();
    const token = await this.issueEmbedToken({
      actor,
      workspaceId: access.activeWorkspace!.id,
      projectId: projectBinding.external_project_id,
      userId: userBinding.external_user_id,
      role,
      piecesTags,
      jti,
      issuedAt,
      expiresAt,
    });

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.activepieces_embed_sessions (
            id,
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
            issued_reason
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
        [
          randomUUID(),
          access.activeWorkspace!.id,
          automation.id,
          actor.id,
          input.purpose ?? role,
          this.hashValue(token),
          expiresAt.toISOString(),
          projectBinding.external_project_id,
          userBinding.external_user_id,
          this.hashValue(jti),
          role,
          automation.id,
          automation.active_canvas_version_id,
          'canvas_advanced_builder',
        ],
      );

      await client.query(
        `
          update app.activepieces_user_bindings
          set
            last_token_issued_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
          where workspace_id = $1
            and auth_user_id = $2
        `,
        [access.activeWorkspace!.id, actor.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'activepieces.embed_token.created',
      entityType: 'installed_automation',
      entityId: automation.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        role,
        runtimeProjectId: projectBinding.external_project_id,
      },
    });

    return {
      instanceUrl: this.env.ACTIVEPIECES_BASE_URL,
      token,
      expiresAt: expiresAt.toISOString(),
      role,
      piecesFilterType: 'allowlist',
      piecesTags:
        workspaceSecurity.piecesTags.length > 0
          ? workspaceSecurity.piecesTags
          : piecesTags,
      runtimeProjectId: projectBinding.external_project_id,
      runtimeFlowId: automation.runtime_flow_id,
      mode: 'embedded-builder',
    };
  }

  async getWorkspaceSecurityOverview(
    access: AccessContext,
  ): Promise<ActivepiecesWorkspaceSecurityState> {
    const workspaceId = access.activeWorkspace?.id ?? null;
    const [settings, runtimeConnections] = await Promise.all([
      workspaceId
        ? this.databaseService.one<ActivepiecesWorkspaceSecurityRow>(
            `
              select
                workspace_id,
                builder_admin_allowed,
                sandbox_required,
                event_streaming_enabled,
                signing_key_configured,
                token_ttl_seconds,
                pieces_filter_type,
                pieces_tags,
                public.is_incident_locked(workspace_id) as incident_lock_active
              from app.activepieces_workspace_security
              where workspace_id = $1
              limit 1
            `,
            [workspaceId],
          )
        : Promise.resolve(null),
      workspaceId
        ? this.listRuntimeConnections(access)
        : Promise.resolve([] as readonly RuntimeConnectionSummary[]),
    ]);

    return {
      workspaceId,
      builderAdminAllowed: settings?.builder_admin_allowed ?? false,
      sandboxRequired: settings?.sandbox_required ?? true,
      eventStreamingEnabled: settings?.event_streaming_enabled ?? false,
      signingKeyConfigured: settings?.signing_key_configured ?? false,
      tokenTtlSeconds: settings?.token_ttl_seconds ?? 300,
      piecesFilterType: settings?.pieces_filter_type ?? 'allowlist',
      piecesTags: settings?.pieces_tags ?? [],
      incidentLockActive: settings?.incident_lock_active ?? false,
      runtimeConnections,
    };
  }

  async getIntegrationStatus(
    access: AccessContext,
  ): Promise<ActivepiecesIntegrationStatus> {
    const [workspaceSecurity, apiProbe] = await Promise.all([
      this.getWorkspaceSecurityOverview(access),
      this.probeActivepiecesApi(),
    ]);
    const simulateRuns = this.env.ACTIVEPIECES_SIMULATE_RUNS === '1';
    const smokePresetCodes = activepiecesSmokeFlows.map((flow) => flow.code);
    const effectivePiecesTags = this.resolveEffectivePiecesTags(
      workspaceSecurity.piecesTags,
    );
    const piecesPolicyReady =
      workspaceSecurity.piecesFilterType === 'allowlist' &&
      effectivePiecesTags.length > 0;
    const apiKeyConfigured = this.isConfiguredValue(
      this.env.ACTIVEPIECES_API_KEY,
      ['stage0_activepieces_api_key'],
    );
    const signingKeyConfigured = this.isConfiguredValue(
      this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
      ['stage0_signing_private_key'],
    );
    const dependencies: ActivepiecesIntegrationStatus['dependencies'] = [
      {
        code: 'app',
        state: apiProbe.reachable ? 'ready' : 'blocked',
        summary: apiProbe.summary,
        details: {
          baseUrl: this.env.ACTIVEPIECES_BASE_URL,
          projectCount: apiProbe.projectCount ?? null,
        },
      },
      {
        code: 'worker',
        state: apiProbe.reachable ? 'ready' : 'blocked',
        summary: apiProbe.reachable
          ? 'Worker availability is inferred from a successful Activepieces API preflight.'
          : 'Worker availability is blocked because the Activepieces API preflight failed.',
        inferred: true,
      },
      {
        code: 'redis',
        state: apiProbe.reachable ? 'ready' : 'blocked',
        summary: apiProbe.reachable
          ? 'Redis availability is inferred from a successful Activepieces API preflight.'
          : 'Redis availability is blocked because the Activepieces API preflight failed.',
        inferred: true,
      },
      {
        code: 'postgres',
        state: apiProbe.reachable ? 'ready' : 'blocked',
        summary: apiProbe.reachable
          ? 'Activepieces Postgres availability is inferred from a successful API preflight.'
          : 'Activepieces Postgres availability is blocked because the API preflight failed.',
        inferred: true,
      },
      {
        code: 'api-key',
        state: apiKeyConfigured ? 'ready' : 'blocked',
        summary: apiKeyConfigured
          ? 'Activepieces API key is configured.'
          : 'Activepieces API key is still using a placeholder value.',
      },
      {
        code: 'signing-key',
        state: signingKeyConfigured ? 'ready' : 'blocked',
        summary: signingKeyConfigured
          ? 'Activepieces signing key is configured in backend env.'
          : 'Activepieces signing key is still using a placeholder value.',
        details: {
          workspaceSecurityFlag: workspaceSecurity.signingKeyConfigured,
        },
      },
      {
        code: 'simulate-mode',
        state: simulateRuns ? 'blocked' : 'ready',
        summary: simulateRuns
          ? 'Simulation mode is enabled, so real Activepieces dispatch is blocked.'
          : 'Simulation mode is disabled and real Activepieces dispatch is allowed.',
      },
      {
        code: 'pieces-policy',
        state: piecesPolicyReady ? 'ready' : 'blocked',
        summary: piecesPolicyReady
          ? 'Allowlist pieces policy is configured for the smoke presets.'
          : 'Allowlist pieces policy is missing effective tags for smoke presets.',
        details: {
          configuredFilterType: workspaceSecurity.piecesFilterType,
          effectivePiecesTags,
          smokePresetCodes,
        },
      },
    ];

    return {
      instanceUrl: this.env.ACTIVEPIECES_BASE_URL,
      simulateRuns,
      canDispatchRealRuns: dependencies.every((item) => item.state === 'ready'),
      piecesFilterType: 'allowlist',
      piecesTags: effectivePiecesTags,
      smokePresetCodes,
      dependencies,
    };
  }

  async syncFlow(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: SyncAutomationRuntimeRequest,
    meta: RequestMeta,
  ): Promise<SyncAutomationRuntimeResponse> {
    if (this.workflowCompilerService) {
      const preview = await this.workflowCompilerService.compilePreview(
        actor,
        access,
        automationId,
        {
          mode: 'sync_draft_to_runtime',
          options: {
            include_advanced_report: true,
          },
        },
        meta,
      );
      const projectId = preview.activepieces_projection?.project_id ?? null;
      const flowId = preview.activepieces_projection?.flow_id ?? null;

      if (!preview.can_sync) {
        throw new AppHttpException(
          'WORKFLOW_COMPILER_BLOCKED',
          409,
          'Workflow compiler blocked runtime sync.',
          {
            blockingIssues: preview.blocking_issues,
            warnings: preview.warnings,
          },
        );
      }

      if (input.dryRun === true) {
        return {
          status: 'noop',
          runtimeProjectId: projectId ?? 'not_synced',
          runtimeFlowId: flowId ?? 'not_synced',
          syncHash:
            preview.activepieces_projection?.sync_hash ??
            preview.source_workflow_hash,
          requiredPieces:
            preview.activepieces_projection?.required_pieces.map(
              (piece) => piece.piece_name,
            ) ?? [],
          requiredConnections:
            preview.activepieces_projection?.required_connections.map(
              (connection) => connection.connection_type,
            ) ?? [],
          warnings: preview.warnings.map((warning) => warning.message),
        };
      }

      const synced = await this.workflowCompilerService.syncRuntime(
        actor,
        access,
        automationId,
        {
          compile_report_id: preview.compile_report_id,
          overwrite_runtime_changes: input.force === true,
          idempotency_key: meta.requestId ?? `runtime-sync:${automationId}`,
        },
        meta,
      );
      if (synced.status === 'runtime_conflict') {
        throw new AppHttpException(
          'WORKFLOW_RUNTIME_DRIFT_CONFLICT',
          409,
          'Activepieces runtime has drifted since the last LexFrame sync.',
          {
            blockingIssues: synced.blocking_issues,
          },
        );
      }

      return {
        status: 'synced',
        runtimeProjectId:
          synced.activepieces_projection?.project_id ?? projectId ?? 'unknown',
        runtimeFlowId:
          synced.activepieces_projection?.flow_id ?? flowId ?? 'unknown',
        syncHash:
          synced.activepieces_projection?.sync_hash ??
          synced.source_workflow_hash,
        requiredPieces:
          synced.activepieces_projection?.required_pieces.map(
            (piece) => piece.piece_name,
          ) ?? [],
        requiredConnections:
          synced.activepieces_projection?.required_connections.map(
            (connection) => connection.connection_type,
          ) ?? [],
        warnings: synced.warnings.map((warning) => warning.message),
      };
    }

    const automation = await this.getInstalledAutomation(
      access.activeWorkspace!.id,
      automationId,
    );
    const validation = isCanvasWorkflowLike(automation.workflow)
      ? this.canvasValidationService.runtimeGateValidate(automation.workflow)
      : null;
    if (validation && (!validation.can_compile || !validation.can_run)) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Canvas runtime validation must pass before runtime sync.',
        { validation },
      );
    }
    const bindingBlocks = this.collectBindingCompileBlocks(automation.workflow);
    if (bindingBlocks.length > 0) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        `Canvas bindings must be repaired before runtime sync: ${bindingBlocks.join(', ')}`,
      );
    }
    const projectBinding = await this.ensureProjectBinding(
      access.activeWorkspace!.id,
      actor,
      automation,
    );
    const projection = this.buildRuntimeProjection(automation);
    const syncHash = this.hashJson(projection);
    const remoteFlowId =
      automation.runtime_flow_id ??
      (await this.ensureRemoteFlow(
        projectBinding.external_project_id,
        automation,
      ));
    const bindingId = randomUUID();
    const jobId = randomUUID();
    const requiredPieces = this.deriveRequiredPieces(automation.workflow).map(
      (piece) => piece.packageName,
    );
    const requiredConnections = (automation.requirements ?? [])
      .filter((requirement) => requirement.kind === 'connection')
      .map((requirement) => requirement.code.replace(/^connection\./, ''));
    const warnings = this.buildRuntimeWarnings(
      automation,
      [],
      this.deriveRequiredPieces(automation.workflow),
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_sync_jobs (
            id,
            installed_automation_id,
            workspace_id,
            request_actor_user_id,
            status,
            sync_hash
          )
          values ($1, $2, $3, $4, 'started', $5)
        `,
        [jobId, automation.id, access.activeWorkspace!.id, actor.id, syncHash],
      );

      await client.query(
        `
          insert into app.automation_runtime_bindings (
            id,
            installed_automation_id,
            workspace_id,
            source_template_version_id,
            external_project_id,
            external_flow_id,
            sync_hash,
            projection,
            status,
            last_synced_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'synced', timezone('utc', now()))
          on conflict (installed_automation_id) do update
          set
            external_project_id = excluded.external_project_id,
            external_flow_id = excluded.external_flow_id,
            sync_hash = excluded.sync_hash,
            projection = excluded.projection,
            status = excluded.status,
            last_error = null,
            last_synced_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        `,
        [
          bindingId,
          automation.id,
          access.activeWorkspace!.id,
          automation.source_template_version_id,
          projectBinding.external_project_id,
          remoteFlowId,
          syncHash,
          JSON.stringify(projection),
        ],
      );

      await client.query(
        `
          update app.installed_automations
          set
            workflow_state = 'compiled',
            builder_state = 'ready',
            sync_state = 'synced',
            compatibility_status = case
              when array_length(missing_connections, 1) is null then 'compatible'
              when coalesce(array_length(missing_connections, 1), 0) = 0 then 'compatible'
              else compatibility_status
            end,
            runtime_project_id = $2,
            runtime_flow_id = $3,
            sync_hash = $4,
            last_synced_at = timezone('utc', now()),
            next_gate = case
              when coalesce(array_length(missing_connections, 1), 0) = 0
                then 'Runtime synced. Builder access and dry-run execution are available.'
              else 'Runtime synced. Resolve missing connections before running the automation.'
            end,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          automation.id,
          projectBinding.external_project_id,
          remoteFlowId,
          syncHash,
        ],
      );

      await client.query(
        `
          update app.automation_sync_jobs
          set
            status = 'synced',
            finished_at = timezone('utc', now())
          where id = $1
        `,
        [jobId],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'activepieces.flow.synced',
      entityType: 'installed_automation',
      entityId: automation.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        syncHash,
        runtimeProjectId: projectBinding.external_project_id,
        runtimeFlowId: remoteFlowId,
        dryRun: input.dryRun ?? false,
      },
    });

    return {
      status: 'synced',
      runtimeProjectId: projectBinding.external_project_id,
      runtimeFlowId: remoteFlowId,
      syncHash,
      requiredPieces: [...new Set(requiredPieces)],
      requiredConnections: [...new Set(requiredConnections)],
      warnings,
    };
  }

  async listRuntimeConnections(
    access: AccessContext,
  ): Promise<readonly RuntimeConnectionSummary[]> {
    const result = await this.databaseService.query<RuntimeConnectionRow>(
      `
        select
          id,
          code,
          provider,
          display_name,
          scope,
          status,
          external_connection_name,
          last_checked_at
        from app.runtime_connections
        where workspace_id = $1
        order by updated_at desc, created_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      provider: row.provider,
      displayName: row.display_name,
      scope: row.scope,
      status: row.status,
      externalConnectionName: row.external_connection_name,
      lastCheckedAt: row.last_checked_at,
      usedByAutomationIds: [],
    }));
  }

  async upsertRuntimeConnection(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: UpsertRuntimeConnectionRequest,
    meta: RequestMeta,
  ): Promise<RuntimeConnectionSummary> {
    const id = randomUUID();
    const displayName =
      input.displayName?.trim() || `${input.provider} connection`;

    const row = await this.databaseService.one<RuntimeConnectionRow>(
      `
        insert into app.runtime_connections (
          id,
          workspace_id,
          code,
          provider,
          display_name,
          external_connection_name,
          scope,
          status,
          created_by_user_id,
          last_checked_at
        )
        values ($1, $2, $3, $4, $5, $6, 'workspace', 'connected', $7, timezone('utc', now()))
        on conflict (workspace_id, code) do update
        set
          provider = excluded.provider,
          display_name = excluded.display_name,
          external_connection_name = excluded.external_connection_name,
          status = 'connected',
          last_checked_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning
          id,
          code,
          provider,
          display_name,
          scope,
          status,
          external_connection_name,
          last_checked_at
      `,
      [
        id,
        access.activeWorkspace!.id,
        input.code.trim(),
        input.provider.trim(),
        displayName,
        input.externalConnectionName?.trim() || null,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Runtime connection upsert did not return a row.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'activepieces.connection.created',
      entityType: 'runtime_connection',
      entityId: row.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        code: row.code,
        provider: row.provider,
      },
    });

    return {
      id: row.id,
      code: row.code,
      provider: row.provider,
      displayName: row.display_name,
      scope: row.scope,
      status: row.status,
      externalConnectionName: row.external_connection_name,
      lastCheckedAt: row.last_checked_at,
      usedByAutomationIds: [],
    };
  }

  async startRun(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: StartAutomationRunRequest,
    meta: RequestMeta,
  ): Promise<StartAutomationRunResponse> {
    const requirements = await this.getAutomationRuntimeRequirements(
      access,
      automationId,
    );

    if (!requirements.canRun) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Automation cannot run until runtime sync and required connections are ready.',
        {
          missingConnections: requirements.missingConnections.map(
            (item) => item.code,
          ),
        },
      );
    }

    const automation = await this.getInstalledAutomation(
      access.activeWorkspace!.id,
      automationId,
    );
    const runtimeBinding = await this.databaseService.one<RuntimeBindingRow>(
      `
        select
          id,
          installed_automation_id,
          automation_version_id,
          runtime_projection_id,
          external_project_id,
          external_flow_id,
          sync_hash,
          status,
          last_synced_at
        from app.automation_runtime_bindings
        where workspace_id = $1
          and installed_automation_id = $2
          and active = true
        limit 1
      `,
      [access.activeWorkspace!.id, automation.id],
    );

    if (!runtimeBinding) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Runtime binding is missing. Sync the automation before running it.',
      );
    }
    if (
      automation.active_canvas_version_id &&
      runtimeBinding.automation_version_id !==
        automation.active_canvas_version_id
    ) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Runtime binding does not point to the active Canvas version.',
        {
          activeCanvasVersionId: automation.active_canvas_version_id,
          runtimeBindingVersionId: runtimeBinding.automation_version_id,
        },
      );
    }

    if (input.mode === 'full_run' && this.workflowCompilerService) {
      const drift = await this.workflowCompilerService.checkDrift(
        actor,
        access,
        automationId,
        meta,
      );
      if (drift.status !== 'synced') {
        throw new AppHttpException(
          'RUNTIME_RECONCILIATION_REQUIRED',
          409,
          'Activepieces runtime changed after the last LexFrame sync. Review or overwrite runtime before full run.',
          {
            status: drift.status,
            currentRuntimeHash: drift.current_runtime_hash,
            lastSyncedHash: drift.last_synced_hash,
            issueCodes: drift.issues.map((issue) => issue.code),
          },
        );
      }
    }

    const runVersionSnapshot = await this.loadRunVersionSnapshot(
      access.activeWorkspace!.id,
      automation,
      runtimeBinding,
    );

    const dispatchMode =
      this.env.ACTIVEPIECES_SIMULATE_RUNS === '1'
        ? 'simulated'
        : 'activepieces-api';
    const runId = randomUUID();
    const traceId =
      meta.traceId ?? `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const externalRunId = `ap_run_${runId.replace(/-/g, '').slice(0, 12)}`;
    const stepSummaries = this.buildStepSummaries(automation.workflow);
    const callbackToken = this.buildCallbackToken(runId, traceId);

    if (dispatchMode === 'activepieces-api') {
      await this.assertRealDispatchReady(access);
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.workflow_runs (
            id,
            workspace_id,
            installed_automation_id,
            automation_runtime_binding_id,
            automation_version_id,
            workflow_snapshot_hash,
            workflow_snapshot,
            runtime_projection_id,
            runtime_projection_snapshot,
            external_run_id,
            mode,
            status,
            current_step,
            progress_percent,
            trace_id,
            step_status,
            artifact_refs,
            approval_state,
            started_at,
            idempotency_key,
            created_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            $8,
            $9::jsonb,
            $10,
            $11,
            'queued',
            $12,
            0,
            $13,
            $14::jsonb,
            '[]'::jsonb,
            $15,
            timezone('utc', now()),
            $16,
            $17
          )
        `,
        [
          runId,
          access.activeWorkspace!.id,
          automation.id,
          runtimeBinding.id,
          runVersionSnapshot.automationVersionId,
          runVersionSnapshot.workflowSnapshotHash,
          JSON.stringify(runVersionSnapshot.workflowSnapshot),
          runVersionSnapshot.runtimeProjectionId,
          JSON.stringify(runVersionSnapshot.runtimeProjectionSnapshot),
          externalRunId,
          input.mode,
          stepSummaries[0]?.stepCode ?? 'start',
          traceId,
          JSON.stringify(stepSummaries),
          stepSummaries.some((step) => step.requiresApproval)
            ? 'pending'
            : 'not_required',
          input.idempotencyKey ?? null,
          actor.id,
        ],
      );

      for (const [index, step] of stepSummaries.entries()) {
        await client.query(
          `
            insert into app.workflow_run_steps (
              id,
              workflow_run_id,
              workspace_id,
              position,
              step_code,
              module_code,
              status,
              requires_approval
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            randomUUID(),
            runId,
            access.activeWorkspace!.id,
            index,
            step.stepCode,
            step.moduleCode,
            'queued',
            step.requiresApproval,
          ],
        );
      }

      await client.query(
        `
          insert into app.activepieces_run_bindings (
            id,
            workflow_run_id,
            workspace_id,
            external_flow_id,
            external_run_id,
            callback_token_hash,
            status
          )
          values ($1, $2, $3, $4, $5, $6, 'queued')
        `,
        [
          randomUUID(),
          runId,
          access.activeWorkspace!.id,
          runtimeBinding.external_flow_id,
          externalRunId,
          this.hashValue(callbackToken),
        ],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'activepieces.run.started',
      entityType: 'workflow_run',
      entityId: runId,
      result: 'success',
      requestId: meta.requestId,
      traceId,
      metadata: {
        automationId,
        externalRunId,
        mode: input.mode,
      },
    });

    if (this.env.ACTIVEPIECES_SIMULATE_RUNS === '1') {
      await this.simulateRunLifecycle(
        actor,
        access,
        runId,
        externalRunId,
        stepSummaries,
        input.mode,
        meta,
      );
    } else {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId: access.activeWorkspace!.id,
        action: 'activepieces.run.dispatched',
        entityType: 'workflow_run',
        entityId: runId,
        result: 'success',
        requestId: meta.requestId,
        traceId,
        metadata: {
          automationId,
          runtimeProjectId: runtimeBinding.external_project_id,
          runtimeFlowId: runtimeBinding.external_flow_id,
          externalRunId,
          mode: input.mode,
          dispatchMode,
        },
      });
    }

    const run = await this.databaseService.one<WorkflowRunStatusRow>(
      `
        select status, trace_id
        from app.workflow_runs
        where id = $1
        limit 1
      `,
      [runId],
    );

    return {
      runId,
      status: run?.status ?? 'queued',
      traceId: run?.trace_id ?? traceId,
      externalRunId,
      dispatchMode,
    };
  }

  async runSmoke(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: ActivepiecesRunSmokeRequest,
    meta: RequestMeta,
  ): Promise<ActivepiecesRunSmokeResponse> {
    const mode = input.mode ?? 'dry_run';
    const automation = await this.getInstalledAutomation(
      access.activeWorkspace!.id,
      input.automationId,
    );
    const steps = this.buildStepSummaries(automation.workflow);
    const start = await this.startRun(
      actor,
      access,
      input.automationId,
      {
        mode,
      },
      meta,
    );

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: start.runId,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        `run:${start.runId}`,
      ],
      eventType: 'run.created',
      entityType: 'workflow_run',
      entityId: start.runId,
      payload: {
        runId: start.runId,
        automationId: input.automationId,
        externalRunId: start.externalRunId ?? null,
        traceId: start.traceId,
        mode,
        source: 'activepieces.run_smoke',
      },
    });

    if (start.dispatchMode === 'activepieces-api') {
      await this.dispatchSmokeCallbacks(
        actor,
        access,
        automation.title,
        start.runId,
        start.traceId,
        start.externalRunId ?? null,
        steps,
        mode,
        meta,
      );
    }

    return this.loadRunSmokeSummary(start.runId);
  }

  async handleStepEvent(
    payload: ActivepiecesStepEventCallback,
    authorization: string | undefined,
  ) {
    const run = await this.verifyRuntimeAuthorization(
      payload.runId,
      authorization,
    );
    await this.recordCallbackReceipt(
      run.workspace_id,
      payload.runId,
      payload.idempotencyKey,
      'step_event',
      payload,
    );
    await this.applyStepEvent(run.workspace_id, payload.runId, payload);
    return { status: 'processed' as const };
  }

  async handleRunEvent(
    payload: ActivepiecesRunEventCallback,
    authorization: string | undefined,
  ) {
    const run = await this.verifyRuntimeAuthorization(
      payload.runId,
      authorization,
    );
    await this.recordCallbackReceipt(
      run.workspace_id,
      payload.runId,
      payload.idempotencyKey,
      'run_event',
      payload,
    );
    await this.applyRunEvent(run.workspace_id, payload.runId, payload);
    return { status: 'processed' as const };
  }

  async handleApprovalGate(
    payload: RuntimeApprovalGateCallback,
    authorization: string | undefined,
  ) {
    const run = await this.verifyRuntimeAuthorization(
      payload.runId,
      authorization,
    );
    await this.recordCallbackReceipt(
      run.workspace_id,
      payload.runId,
      payload.idempotencyKey,
      'approval_gate',
      payload,
    );
    const task = await this.approvalsService.createRuntimeTask({
      workspaceId: run.workspace_id,
      workflowRunId: payload.runId,
      title: payload.title,
      kind: 'run_approval',
      routeId: payload.approvalRouteId ?? null,
      approverUserId: payload.approverUserId ?? null,
      approverRole: payload.approverRole ?? null,
      expiresAt: payload.expiresAt ?? null,
      metadata: {
        ...(payload.metadata ?? {}),
        stepCode: payload.stepCode,
        occurredAt: payload.occurredAt,
      },
    });

    return {
      status: 'processed' as const,
      approvalTaskId: task.id,
    };
  }

  async handleDeliveryGate(
    payload: RuntimeDeliveryGateCallback,
    authorization: string | undefined,
  ) {
    const run = await this.verifyRuntimeAuthorization(
      payload.runId,
      authorization,
    );
    await this.recordCallbackReceipt(
      run.workspace_id,
      payload.runId,
      payload.idempotencyKey,
      'delivery_gate',
      payload,
    );
    const request = await this.deliveryService.createRuntimeRequest({
      workspaceId: run.workspace_id,
      workflowRunId: payload.runId,
      title: payload.title,
      subject: payload.subject,
      body: payload.body,
      recipientEmails: payload.recipientEmails,
      artifactIds: payload.artifactIds ?? [],
      requiresApproval: payload.requiresApproval ?? true,
      metadata: {
        ...(payload.metadata ?? {}),
        occurredAt: payload.occurredAt,
      },
      idempotencyKey: payload.idempotencyKey,
    });

    return {
      status: 'processed' as const,
      deliveryRequestId: request.id,
    };
  }

  async ingestRuntimeArtifact(
    runId: string,
    authorization: string | undefined,
    input: CreateRunArtifactRequest,
  ) {
    const run = await this.verifyRuntimeAuthorization(runId, authorization);
    const actor = await this.loadRunActor(run);
    const access: AccessContext = {
      activeWorkspace: {
        id: run.workspace_id,
        slug: run.workspace_id,
        name: run.workspace_id,
        role: 'owner',
        status: 'active',
      },
      roles: ['owner'],
      permissions: ['automation.run', 'document.upload', 'document.read'],
    };

    const artifact = await this.documentsService.createRunArtifact(
      actor,
      access,
      runId,
      input,
      {
        requestId: null,
        traceId: run.trace_id,
      },
    );

    await this.appendArtifactRef(runId, artifact.id);
    await this.recordCallbackReceipt(
      run.workspace_id,
      runId,
      `${artifact.id}:artifact`,
      'artifact',
      artifact,
    );

    return artifact;
  }

  private async getInstalledAutomation(
    workspaceId: string,
    automationId: string,
  ): Promise<InstalledAutomationRuntimeRow> {
    const row = await this.databaseService.one<InstalledAutomationRuntimeRow>(
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
          disabled_reason,
          required_inputs,
          requirements,
          workflow,
          active_canvas_version_id,
          production_disabled_at,
          production_disabled_reason,
          next_gate,
          runtime_project_id,
          runtime_flow_id,
          sync_hash,
          last_synced_at
        from app.installed_automations
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );

    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Installed automation was not found.',
      );
    }

    return row;
  }

  private async loadRunVersionSnapshot(
    workspaceId: string,
    automation: InstalledAutomationRuntimeRow,
    runtimeBinding: RuntimeBindingRow,
  ) {
    const versionId =
      automation.active_canvas_version_id ??
      runtimeBinding.automation_version_id ??
      null;
    if (!versionId) {
      return {
        automationVersionId: null,
        workflowSnapshotHash: automation.sync_hash,
        workflowSnapshot: automation.workflow,
        runtimeProjectionId: runtimeBinding.runtime_projection_id,
        runtimeProjectionSnapshot: null,
      };
    }
    const row = await this.databaseService.one<{
      readonly id: string;
      readonly workflow: unknown;
      readonly workflow_hash: string;
      readonly runtime_projection_id: string | null;
      readonly projection_json: unknown;
    }>(
      `
        select v.id, v.workflow, v.workflow_hash, v.runtime_projection_id,
               p.projection_json
        from app.automation_canvas_versions v
        left join app.automation_runtime_projections p
          on p.id = v.runtime_projection_id
        where v.workspace_id = $1
          and v.installed_automation_id = $2
          and v.id = $3
        limit 1
      `,
      [workspaceId, automation.id, versionId],
    );
    return {
      automationVersionId: row?.id ?? versionId,
      workflowSnapshotHash: row?.workflow_hash ?? automation.sync_hash,
      workflowSnapshot: row?.workflow ?? automation.workflow,
      runtimeProjectionId:
        row?.runtime_projection_id ?? runtimeBinding.runtime_projection_id,
      runtimeProjectionSnapshot:
        row?.projection_json ?? runtimeBinding.sync_hash,
    };
  }

  private async resolveConnectionState(
    workspaceId: string,
    automation: InstalledAutomationRuntimeRow,
    automationId: string,
  ) {
    const requiredCodes = (automation.requirements ?? [])
      .filter((requirement) => requirement.kind === 'connection')
      .map((requirement) => requirement.code.replace(/^connection\./, ''));
    const result = await this.databaseService.query<RuntimeConnectionRow>(
      `
        select
          id,
          code,
          provider,
          display_name,
          scope,
          status,
          external_connection_name,
          last_checked_at
        from app.runtime_connections
        where workspace_id = $1
      `,
      [workspaceId],
    );
    const byCode = new Map(result.rows.map((row) => [row.code, row]));
    const available: RuntimeConnectionSummary[] = [];
    const missing: RuntimeConnectionSummary[] = [];

    for (const code of requiredCodes) {
      const row = byCode.get(code);
      if (!row || row.status !== 'connected') {
        missing.push({
          id: row?.id ?? `missing:${code}`,
          code,
          provider: row?.provider ?? code,
          displayName: row?.display_name ?? `${code} connection`,
          scope: row?.scope ?? 'workspace',
          status: row?.status ?? 'missing',
          externalConnectionName: row?.external_connection_name ?? null,
          lastCheckedAt: row?.last_checked_at ?? null,
          usedByAutomationIds: [automationId],
        });
        continue;
      }

      available.push({
        id: row.id,
        code: row.code,
        provider: row.provider,
        displayName: row.display_name,
        scope: row.scope,
        status: row.status,
        externalConnectionName: row.external_connection_name,
        lastCheckedAt: row.last_checked_at,
        usedByAutomationIds: [automationId],
      });
    }

    return {
      available,
      missing,
    };
  }

  private deriveRequiredPieces(
    workflow: Record<string, unknown> | null,
  ): readonly RuntimePieceRequirement[] {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
    const pieces: RuntimePieceRequirement[] = [];

    for (const step of steps) {
      if (
        typeof step !== 'object' ||
        step === null ||
        typeof step.id !== 'string' ||
        typeof step.moduleCode !== 'string'
      ) {
        continue;
      }
      const moduleCode = (step as { readonly moduleCode: string }).moduleCode;

      pieces.push({
        stepCode: step.id,
        packageName: this.moduleCodeToPiecePackage(moduleCode),
        status: 'available',
      });
    }

    return pieces;
  }

  private buildRuntimeWarnings(
    automation: InstalledAutomationRuntimeRow,
    missingConnections: readonly RuntimeConnectionSummary[],
    pieces: readonly RuntimePieceRequirement[],
  ): readonly string[] {
    const warnings: string[] = [];

    if (automation.sync_state !== 'synced') {
      warnings.push(
        'Runtime projection is not synced yet. Sync the automation before opening the builder.',
      );
    }

    if (missingConnections.length > 0) {
      warnings.push(
        `Missing connections: ${missingConnections.map((item) => item.code).join(', ')}.`,
      );
    }

    if (
      Array.isArray(automation.workflow?.steps) &&
      automation.workflow.steps.some(
        (step) =>
          typeof step === 'object' &&
          step !== null &&
          (step as Record<string, unknown>).requiresApproval === true,
      )
    ) {
      warnings.push(
        'This workflow contains steps that require manual approval.',
      );
    }

    if (pieces.length === 0) {
      warnings.push(
        'No runtime pieces were derived from the workflow definition.',
      );
    }

    return warnings;
  }

  private async ensureProjectBinding(
    workspaceId: string,
    actor: AuthenticatedActor,
    automation: InstalledAutomationRuntimeRow,
  ) {
    const existing = await this.databaseService.one<{
      readonly id: string;
      readonly external_project_id: string;
    }>(
      `
        select id, external_project_id
        from app.activepieces_project_bindings
        where workspace_id = $1
        limit 1
      `,
      [workspaceId],
    );

    if (existing) {
      return existing;
    }

    const externalProjectId = `${this.env.ACTIVEPIECES_PROJECT_PREFIX}-${workspaceId}`;
    const remoteProjectId = await this.ensureRemoteProject(
      externalProjectId,
      automation.title,
    );

    const existingByRemoteProject = await this.databaseService.one<{
      readonly id: string;
      readonly external_project_id: string;
    }>(
      `
        select id, external_project_id
        from app.activepieces_project_bindings
        where external_project_id = $1
        limit 1
      `,
      [remoteProjectId],
    );

    if (existingByRemoteProject) {
      return existingByRemoteProject;
    }

    let row: {
      readonly id: string;
      readonly external_project_id: string;
    } | null = null;

    try {
      row = await this.databaseService.one<{
        readonly id: string;
        readonly external_project_id: string;
      }>(
        `
          insert into app.activepieces_project_bindings (
            id,
            workspace_id,
            external_project_id,
            display_name,
            status,
            created_by_user_id,
            last_synced_at
          )
          values ($1, $2, $3, $4, 'active', $5, timezone('utc', now()))
          on conflict (workspace_id) do update
          set
            external_project_id = excluded.external_project_id,
            display_name = excluded.display_name,
            status = 'active',
            updated_at = timezone('utc', now())
          returning id, external_project_id
        `,
        [
          randomUUID(),
          workspaceId,
          remoteProjectId,
          `${automation.title} runtime`,
          actor.id,
        ],
      );
    } catch (error) {
      if (
        isUniqueConstraintError(
          error,
          'activepieces_project_bindings_external_project_id_key',
        )
      ) {
        const sharedBinding = await this.databaseService.one<{
          readonly id: string;
          readonly external_project_id: string;
        }>(
          `
            select id, external_project_id
            from app.activepieces_project_bindings
            where external_project_id = $1
            limit 1
          `,
          [remoteProjectId],
        );

        if (sharedBinding) {
          return sharedBinding;
        }
      }

      throw error;
    }

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Project binding was not created.',
      );
    }

    return row;
  }

  private async ensureUserBinding(
    workspaceId: string,
    actor: AuthenticatedActor,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER',
  ) {
    const externalUserId = `lf-user-${actor.id}`;
    const row = await this.databaseService.one<{
      readonly external_user_id: string;
    }>(
      `
        insert into app.activepieces_user_bindings (
          id,
          workspace_id,
          auth_user_id,
          external_user_id,
          role
        )
        values ($1, $2, $3, $4, $5)
        on conflict (workspace_id, auth_user_id) do update
        set
          role = excluded.role,
          updated_at = timezone('utc', now())
        returning external_user_id
      `,
      [randomUUID(), workspaceId, actor.id, externalUserId, role],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'User binding was not created.',
      );
    }

    return row;
  }

  private async issueEmbedToken(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly projectId: string;
    readonly userId: string;
    readonly role: 'builder' | 'viewer';
    readonly piecesTags: readonly string[];
    readonly jti: string;
    readonly issuedAt: number;
    readonly expiresAt: Date;
  }) {
    const claims = {
      externalUserId: input.userId,
      externalProjectId: input.projectId,
      role: input.role === 'builder' ? 'EDITOR' : 'VIEWER',
      piecesFilterType: 'ALLOWED',
      piecesTags: input.piecesTags,
      workspaceId: input.workspaceId,
    } as const;

    try {
      if (
        this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')
      ) {
        const privateKey = await importPKCS8(
          this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
          'RS256',
        );
        return await new SignJWT(claims)
          .setProtectedHeader({
            alg: 'RS256',
            kid: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          })
          .setIssuedAt(input.issuedAt)
          .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
          .setJti(input.jti)
          .sign(privateKey);
      }
    } catch {
      // Dev fallback below.
    }

    return `dev.${Buffer.from(
      JSON.stringify({
        ...claims,
        exp: input.expiresAt.toISOString(),
        jti: input.jti,
      }),
    ).toString('base64url')}`;
  }

  private buildRuntimeProjection(automation: InstalledAutomationRuntimeRow) {
    const steps = Array.isArray(automation.workflow?.steps)
      ? automation.workflow.steps
      : Array.isArray(automation.workflow?.nodes)
        ? automation.workflow.nodes.filter(
            (node) =>
              typeof node === 'object' &&
              node !== null &&
              !['trigger', 'end', 'note'].includes(
                String((node as Record<string, unknown>).type),
              ),
          )
        : [];

    return {
      installedAutomationId: automation.id,
      title: automation.title,
      version: automation.version,
      generatedAt: new Date().toISOString(),
      steps: steps
        .map((step, index) => {
          if (
            typeof step !== 'object' ||
            step === null ||
            typeof step.id !== 'string' ||
            (typeof step.moduleCode !== 'string' &&
              typeof (step as Record<string, unknown>).module_code !== 'string')
          ) {
            return null;
          }
          const moduleCode =
            (step as { readonly moduleCode?: string }).moduleCode ??
            ((step as Record<string, unknown>).module_code as string);

          return {
            position: index,
            stepCode: step.id,
            moduleCode,
            pieceName: this.moduleCodeToPiecePackage(moduleCode),
            actionName: moduleCode.split('.').slice(1).join('_'),
            dependencies: Array.isArray(step.dependencies)
              ? step.dependencies.filter(
                  (item: unknown): item is string => typeof item === 'string',
                )
              : [],
            requiresApproval: Boolean(
              (step as Record<string, unknown>).requiresApproval,
            ),
            props: this.buildCanvasStepProps(step as Record<string, unknown>),
            bindings: this.buildCanvasStepBindings(
              step as Record<string, unknown>,
            ),
          };
        })
        .filter((value) => value !== null),
      inputs:
        Array.isArray(automation.workflow?.inputs) &&
        automation.workflow?.inputs
          ? automation.workflow.inputs
          : [],
      requirements: automation.requirements ?? [],
    };
  }

  private collectBindingCompileBlocks(
    workflow: Record<string, unknown> | null,
  ) {
    if (!workflow || !isRecord(workflow.validation)) {
      return [];
    }
    const issues = Array.isArray(workflow.validation.issues)
      ? workflow.validation.issues
      : [];
    return issues
      .filter(
        (issue): issue is Record<string, unknown> =>
          isRecord(issue) &&
          issue.scope === 'binding' &&
          (issue.severity === 'error' || issue.severity === 'policy_block'),
      )
      .map(
        (issue) =>
          stringValue(issue.code) ?? stringValue(issue.id) ?? 'invalid_binding',
      );
  }

  private buildCanvasStepProps(step: Record<string, unknown>) {
    const props: Record<string, unknown> = {};
    for (const binding of validInputBindings(step)) {
      const target = bindingTarget(binding);
      if (!target?.input_key) {
        continue;
      }
      props[target.input_key] = this.runtimeValueFromBinding(binding);
    }
    return props;
  }

  private buildCanvasStepBindings(step: Record<string, unknown>) {
    return validInputBindings(step).map((binding) => {
      const target = bindingTarget(binding);
      const fallbackNodeId = target.node_id ?? stringValue(step.id) ?? 'step';
      const fallbackInputKey = target.input_key ?? 'input';

      return {
        id:
          typeof binding.id === 'string'
            ? binding.id
            : `${fallbackNodeId}:${fallbackInputKey}`,
        target,
        source: redactRuntimeBindingSource(binding.source),
        transform: isRecord(binding.transform) ? binding.transform : null,
        selection: isRecord(binding.selection) ? binding.selection : null,
      };
    });
  }

  private runtimeValueFromBinding(binding: Record<string, unknown>) {
    const source = isRecord(binding.source) ? binding.source : {};
    const transform = isRecord(binding.transform) ? binding.transform : null;
    const selection = isRecord(binding.selection) ? binding.selection : null;
    let value: unknown;

    if (source.type === 'workflow_input') {
      const inputKey = stringValue(source.input_key) ?? 'input';
      value = { type: 'workflow_input', path: `inputs.${inputKey}` };
    } else if (source.type === 'step_output') {
      value = {
        type: 'step_output',
        node_id: source.node_id,
        output_key: source.output_key,
        path: source.path ?? null,
      };
    } else if (source.type === 'document') {
      value = {
        type: 'document_ref',
        document_id: source.document_id,
        document_version_id: source.document_version_id ?? null,
        access_mode: 'runtime_scoped_token',
      };
    } else if (source.type === 'secret_ref') {
      value = {
        type: 'secret_ref',
        secret_ref: source.secret_ref,
      };
    } else if (source.type === 'connection') {
      value = {
        type: 'connection_ref',
        connection_id: source.connection_id,
      };
    } else if (source.type === 'system_value') {
      value = {
        type: 'system_value',
        key: source.key,
      };
    } else if (source.type === 'transform') {
      value = {
        type: 'transform',
        transform_type: source.transform_type,
        source: redactRuntimeBindingSource(source.source),
        config: source.config ?? {},
      };
    } else if (source.type === 'manual_value' || source.type === 'literal') {
      value = { type: 'literal', value: source.value };
    } else {
      value = { type: source.type ?? 'unknown' };
    }

    return transform || selection
      ? {
          value,
          transform,
          selection,
        }
      : value;
  }

  private moduleCodeToPiecePackage(moduleCode: string) {
    if (moduleCode.startsWith('legal.')) {
      return '@lexframe/piece-legal';
    }

    if (moduleCode.startsWith('document.')) {
      return '@lexframe/piece-document';
    }

    if (moduleCode.startsWith('delivery.')) {
      return '@lexframe/piece-delivery';
    }

    if (moduleCode.startsWith('workflow.')) {
      return '@lexframe/piece-callback';
    }

    return '@lexframe/piece-gateway';
  }

  private derivePiecesTags(workflow: Record<string, unknown> | null) {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
    const tags = new Set<string>(['lexframe-core']);

    for (const step of steps) {
      if (
        typeof step !== 'object' ||
        step === null ||
        typeof step.moduleCode !== 'string'
      ) {
        continue;
      }

      if (step.moduleCode.startsWith('legal.')) {
        tags.add('legal-core');
      } else if (step.moduleCode.startsWith('document.')) {
        tags.add('document-core');
      } else if (step.moduleCode.startsWith('delivery.')) {
        tags.add('delivery-safe');
      } else if (step.moduleCode.startsWith('workflow.')) {
        tags.add('workflow-control');
      }
    }

    return [...tags];
  }

  private buildStepSummaries(workflow: Record<string, unknown> | null) {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
    return steps
      .map((step) => {
        if (
          typeof step !== 'object' ||
          step === null ||
          typeof step.id !== 'string' ||
          typeof step.moduleCode !== 'string'
        ) {
          return null;
        }

        return {
          stepCode: step.id,
          moduleCode: step.moduleCode,
          status: 'queued' as const,
          requiresApproval: Boolean(
            (step as Record<string, unknown>).requiresApproval,
          ),
          errorCode: null,
        };
      })
      .filter(
        (
          value,
        ): value is {
          readonly stepCode: string;
          readonly moduleCode: string;
          readonly status: 'queued';
          readonly requiresApproval: boolean;
          readonly errorCode: null;
        } => value !== null,
      );
  }

  private buildCallbackToken(runId: string, traceId: string) {
    return [
      'lf-runtime',
      runId,
      traceId,
      this.hashValue(
        `${runId}:${traceId}:${this.env.LEXFRAME_RUNTIME_MASTER_SECRET}`,
      ),
    ].join('.');
  }

  private async verifyRuntimeAuthorization(
    runId: string,
    authorization: string | undefined,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new AppHttpException(
        'AUTH_REQUIRED',
        401,
        'Runtime authorization token is required.',
      );
    }

    const binding = await this.databaseService.one<WorkflowRunBindingRow>(
      `
        select workflow_run_id, workspace_id, callback_token_hash
        from app.activepieces_run_bindings
        where workflow_run_id = $1
        limit 1
      `,
      [runId],
    );

    if (!binding || binding.callback_token_hash !== this.hashValue(token)) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Runtime authorization token is invalid.',
      );
    }

    const run = await this.databaseService.one<WorkflowRunRow>(
      `
        select
          id,
          workspace_id,
          installed_automation_id,
          trace_id,
          external_run_id,
          approval_state,
          created_by_user_id
        from app.workflow_runs
        where id = $1
        limit 1
      `,
      [runId],
    );

    if (!run) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        404,
        'Workflow run was not found.',
      );
    }

    return run;
  }

  private async recordCallbackReceipt(
    workspaceId: string,
    runId: string,
    receiptKey: string,
    callbackType:
      | 'step_event'
      | 'run_event'
      | 'artifact'
      | 'approval_gate'
      | 'delivery_gate',
    payload: unknown,
  ) {
    try {
      await this.databaseService.query(
        `
          insert into app.activepieces_callback_receipts (
            id,
            workspace_id,
            workflow_run_id,
            callback_type,
            receipt_key,
            payload,
            status
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, 'received')
        `,
        [
          randomUUID(),
          workspaceId,
          runId,
          callbackType,
          receiptKey,
          JSON.stringify(payload),
        ],
      );
    } catch {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Duplicate runtime callback was rejected by idempotency control.',
      );
    }
  }

  private async applyStepEvent(
    workspaceId: string,
    runId: string,
    payload: ActivepiecesStepEventCallback,
  ) {
    const nextStatus = payload.eventType;
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.workflow_run_steps
          set
            status = $4,
            outputs = $5::jsonb,
            error_code = $6,
            error_message = $7,
            last_event_at = timezone('utc', now()),
            started_at = case when $4 in ('running', 'completed', 'waiting_approval') and started_at is null then timezone('utc', now()) else started_at end,
            finished_at = case when $4 in ('completed', 'failed') then timezone('utc', now()) else finished_at end,
            updated_at = timezone('utc', now())
          where workflow_run_id = $1
            and workspace_id = $2
            and step_code = $3
        `,
        [
          runId,
          workspaceId,
          payload.stepCode,
          nextStatus,
          JSON.stringify(payload.outputs ?? {}),
          payload.error?.code ?? null,
          payload.error?.message ?? null,
        ],
      );

      const stepRow = await client.query<{ readonly id: string }>(
        `
          select id
          from app.workflow_run_steps
          where workflow_run_id = $1
            and workspace_id = $2
            and step_code = $3
          limit 1
        `,
        [runId, workspaceId, payload.stepCode],
      );

      await client.query(
        `
          insert into app.run_step_events (
            id,
            workflow_run_id,
            workflow_run_step_id,
            workspace_id,
            step_code,
            module_code,
            event_type,
            payload,
            error_code,
            occurred_at,
            idempotency_key
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
          on conflict (idempotency_key) do nothing
        `,
        [
          randomUUID(),
          runId,
          stepRow.rows[0]?.id ?? null,
          workspaceId,
          payload.stepCode,
          payload.moduleCode ?? null,
          payload.eventType,
          JSON.stringify(payload.outputs ?? {}),
          payload.error?.code ?? null,
          payload.occurredAt,
          payload.idempotencyKey,
        ],
      );

      const stepsResult = await client.query<{
        readonly step_code: string;
        readonly module_code: string;
        readonly status:
          | 'queued'
          | 'running'
          | 'waiting_approval'
          | 'completed'
          | 'failed';
        readonly requires_approval: boolean;
        readonly error_code: string | null;
      }>(
        `
          select step_code, module_code, status, requires_approval, error_code
          from app.workflow_run_steps
          where workflow_run_id = $1
          order by position asc
        `,
        [runId],
      );

      const mappedSteps = stepsResult.rows.map((step) => ({
        stepCode: step.step_code,
        moduleCode: step.module_code,
        status: step.status,
        requiresApproval: step.requires_approval,
        errorCode: step.error_code,
      }));
      const completedCount = mappedSteps.filter(
        (step) => step.status === 'completed',
      ).length;
      const progressPercent =
        mappedSteps.length === 0
          ? 0
          : Math.round((completedCount / mappedSteps.length) * 100);

      await client.query(
        `
          update app.workflow_runs
          set
            status = case
              when $4 = 'waiting_approval' then 'waiting_approval'
              when $4 = 'failed' then 'failed'
              when $5 = $6 then 'completed'
              when $4 in ('running', 'completed') then 'running'
              else status
            end,
            current_step = $3,
            progress_percent = $7,
            step_status = $8::jsonb,
            error_code = case when $4 = 'failed' then $9 else error_code end,
            finished_at = case
              when $4 = 'failed' or $5 = $6 then timezone('utc', now())
              else finished_at
            end,
            approval_state = case
              when $4 = 'waiting_approval' then 'pending'
              else approval_state
            end,
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [
          runId,
          workspaceId,
          payload.stepCode,
          nextStatus,
          completedCount,
          mappedSteps.length,
          progressPercent,
          JSON.stringify(mappedSteps),
          payload.error?.code ?? null,
        ],
      );

      await client.query(
        `
          update app.activepieces_callback_receipts
          set
            status = 'processed',
            processed_at = timezone('utc', now())
          where receipt_key = $1
        `,
        [payload.idempotencyKey],
      );

      await this.liveEventsService.recordEvent({
        workspaceId,
        runId,
        topics: [`workspace:${workspaceId}:dashboard`, `run:${runId}`],
        eventType: 'run.step.updated',
        entityType: 'workflow_run_step',
        entityId: `${runId}:${payload.stepCode}`,
        payload: {
          runId,
          stepCode: payload.stepCode,
          moduleCode: payload.moduleCode ?? null,
          status: nextStatus,
          progressPercent,
          errorCode: payload.error?.code ?? null,
          outputs: payload.outputs ?? {},
        },
        client,
      });
    });
  }

  private async applyRunEvent(
    workspaceId: string,
    runId: string,
    payload: ActivepiecesRunEventCallback,
  ) {
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.workflow_runs
          set
            external_run_id = coalesce($3, external_run_id),
            status = $4,
            error_code = $5,
            error_message = $6,
            finished_at = case when $4 in ('completed', 'failed') then timezone('utc', now()) else finished_at end,
            approval_state = case when $4 = 'waiting_approval' then 'pending' else approval_state end,
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [
          runId,
          workspaceId,
          payload.externalRunId ?? null,
          payload.eventType,
          payload.error?.code ?? null,
          payload.error?.message ?? null,
        ],
      );

      await client.query(
        `
          update app.activepieces_run_bindings
          set
            external_run_id = coalesce($2, external_run_id),
            status = $3,
            last_error_code = $4,
            last_error_message = $5,
            last_event_at = timezone('utc', now()),
            last_reconciled_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
          where workflow_run_id = $1
        `,
        [
          runId,
          payload.externalRunId ?? null,
          payload.eventType,
          payload.error?.code ?? null,
          payload.error?.message ?? null,
        ],
      );

      await client.query(
        `
          update app.activepieces_callback_receipts
          set
            status = 'processed',
            processed_at = timezone('utc', now())
          where receipt_key = $1
        `,
        [payload.idempotencyKey],
      );

      await this.liveEventsService.recordEvent({
        workspaceId,
        runId,
        topics: [`workspace:${workspaceId}:dashboard`, `run:${runId}`],
        eventType: mapRunEventType(payload.eventType),
        entityType: 'workflow_run',
        entityId: runId,
        payload: {
          runId,
          externalRunId: payload.externalRunId ?? null,
          status: payload.eventType,
          errorCode: payload.error?.code ?? null,
          errorMessage: payload.error?.message ?? null,
        },
        client,
      });
    });
  }

  private async appendArtifactRef(runId: string, artifactId: string) {
    const row = await this.databaseService.one<{
      readonly artifact_refs: readonly string[] | null;
    }>(
      `
        select artifact_refs
        from app.workflow_runs
        where id = $1
        limit 1
      `,
      [runId],
    );
    const nextRefs = [...new Set([...(row?.artifact_refs ?? []), artifactId])];
    await this.databaseService.query(
      `
        update app.workflow_runs
        set
          artifact_refs = $2::jsonb,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [runId, JSON.stringify(nextRefs)],
    );
  }

  private async loadRunActor(run: WorkflowRunRow): Promise<AuthenticatedActor> {
    const profile = await this.databaseService.one<{
      readonly id: string;
      readonly email: string;
      readonly full_name: string | null;
    }>(
      `
        select id, email, full_name
        from app.profiles
        where id = $1
        limit 1
      `,
      [run.created_by_user_id],
    );

    if (!profile) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Workflow run actor is missing and artifacts cannot be attached.',
      );
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      emailConfirmedAt: new Date().toISOString(),
      assuranceLevel: 'aal1',
      accessToken: 'runtime.system',
      sessionId: `runtime.${run.id}`,
    };
  }

  private async simulateRunLifecycle(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    externalRunId: string,
    steps: readonly {
      readonly stepCode: string;
      readonly moduleCode: string;
      readonly status: 'queued';
      readonly requiresApproval: boolean;
      readonly errorCode: null;
    }[],
    mode: StartAutomationRunRequest['mode'],
    meta: RequestMeta,
  ) {
    await this.applyRunEvent(access.activeWorkspace!.id, runId, {
      runId,
      externalRunId,
      eventType: 'running',
      error: null,
      idempotencyKey: `${runId}:run:running`,
      occurredAt: new Date().toISOString(),
    });

    for (const step of steps) {
      await this.applyStepEvent(access.activeWorkspace!.id, runId, {
        runId,
        externalRunId,
        stepCode: step.stepCode,
        moduleCode: step.moduleCode,
        eventType: 'completed',
        outputs: {
          simulated: true,
          stepCode: step.stepCode,
        },
        error: null,
        idempotencyKey: `${runId}:${step.stepCode}:completed`,
        occurredAt: new Date().toISOString(),
      });
    }

    const artifact = await this.documentsService.createRunArtifact(
      actor,
      access,
      runId,
      {
        artifactType: 'generated_document',
        title: `${steps.at(-1)?.moduleCode ?? 'automation'} result`,
        mimeType: 'application/pdf',
        classification: 'client_material',
        source: 'activepieces_artifact',
      },
      {
        requestId: meta.requestId,
        traceId: meta.traceId,
      },
    );
    await this.appendArtifactRef(runId, artifact.id);

    if (mode === 'full_run') {
      await this.deliveryService.createRuntimeRequest({
        workspaceId: access.activeWorkspace!.id,
        workflowRunId: runId,
        title: `${steps.at(-1)?.moduleCode ?? 'automation'} delivery`,
        subject: `${steps.at(-1)?.moduleCode ?? 'Automation'} smoke result`,
        body: 'Smoke runtime completed and queued the result for delivery approval.',
        recipientEmails: ['sandbox@lexframe.local'],
        artifactIds: [artifact.id],
        requiresApproval: true,
        metadata: {
          smoke: true,
          traceId: meta.traceId,
        },
        idempotencyKey: `${runId}:smoke:delivery`,
      });
      return;
    }

    await this.applyRunEvent(access.activeWorkspace!.id, runId, {
      runId,
      externalRunId,
      eventType: 'completed',
      error: null,
      idempotencyKey: `${runId}:run:completed`,
      occurredAt: new Date().toISOString(),
    });
  }

  private async ensureRemoteProject(externalId: string, displayName: string) {
    try {
      const existing = await this.activepiecesRequest<
        ActivepiecesListResponse<ActivepiecesProjectResponse>
      >(`/projects?limit=1&externalId=${encodeURIComponent(externalId)}`, {
        method: 'GET',
      });
      const existingProject = existing.data?.[0];
      if (existingProject?.id) {
        return existingProject.id;
      }

      const created =
        await this.activepiecesRequest<ActivepiecesProjectResponse>(
          '/projects',
          {
            method: 'POST',
            body: JSON.stringify({
              displayName,
              externalId,
              metadata: {
                managedBy: 'lexframe',
              },
            }),
          },
        );

      return created.id;
    } catch {
      return this.resolveCredentialContext().projectId ?? externalId;
    }
  }

  private async ensureRemoteFlow(
    projectId: string,
    automation: InstalledAutomationRuntimeRow,
  ) {
    try {
      const created = await this.activepiecesRequest<ActivepiecesFlowResponse>(
        '/flows',
        {
          method: 'POST',
          body: JSON.stringify({
            displayName: automation.title,
            projectId,
            metadata: {
              installedAutomationId: automation.id,
              managedBy: 'lexframe',
            },
          }),
        },
      );

      return created.id;
    } catch {
      return `flow_${automation.id.replace(/-/g, '').slice(0, 16)}`;
    }
  }

  private async activepiecesRequest<T>(path: string, init: RequestInit) {
    const response = await fetch(
      `${this.env.ACTIVEPIECES_BASE_URL.replace(/\/$/, '')}/api/v1${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${this.env.ACTIVEPIECES_API_KEY}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Activepieces request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private isConfiguredValue(
    value: string,
    placeholderValues: readonly string[],
  ) {
    const normalized = value.trim();

    return (
      normalized.length > 0 &&
      !normalized.startsWith('replace_with_') &&
      !placeholderValues.includes(normalized)
    );
  }

  private resolveEffectivePiecesTags(configuredTags: readonly string[]) {
    if (configuredTags.length > 0) {
      return [...new Set(configuredTags)];
    }

    const derivedTags = new Set<string>(['lexframe-core']);

    for (const flow of activepiecesSmokeFlows) {
      for (const pieceName of flow.requiredPieces) {
        if (pieceName.includes('legal')) {
          derivedTags.add('legal-core');
        }

        if (pieceName.includes('document')) {
          derivedTags.add('document-core');
        }

        if (pieceName.includes('approval')) {
          derivedTags.add('workflow-control');
        }

        if (pieceName.includes('delivery')) {
          derivedTags.add('delivery-safe');
        }
      }
    }

    return [...derivedTags];
  }

  private async probeActivepiecesApi(): Promise<ActivepiecesApiProbeResult> {
    if (
      !this.isConfiguredValue(this.env.ACTIVEPIECES_API_KEY, [
        'stage0_activepieces_api_key',
      ])
    ) {
      return {
        reachable: false,
        summary: 'Activepieces API key is still using a placeholder value.',
      };
    }

    const credentialContext = this.resolveCredentialContext();

    try {
      const response = await this.activepiecesRequest<
        ActivepiecesListResponse<ActivepiecesProjectResponse>
      >('/projects?limit=1', {
        method: 'GET',
      });

      return {
        reachable: true,
        summary: 'Activepieces API preflight succeeded.',
        projectCount: response.data?.length ?? 0,
      };
    } catch (primaryError) {
      if (credentialContext.projectId) {
        try {
          await this.activepiecesRequest<ActivepiecesListResponse<unknown>>(
            `/flows?projectId=${encodeURIComponent(
              credentialContext.projectId,
            )}&limit=1`,
            {
              method: 'GET',
            },
          );

          return {
            reachable: true,
            summary:
              credentialContext.tokenType === 'jwt'
                ? 'Activepieces API preflight succeeded via the scoped project flow list for a local account token.'
                : 'Activepieces API preflight succeeded via the scoped project flow list.',
            projectCount: 1,
          };
        } catch (fallbackError) {
          return {
            reachable: false,
            summary: `Activepieces API preflight failed: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : 'unknown error'
            }`,
          };
        }
      }

      try {
        const flagsResponse = await fetch(
          `${this.env.ACTIVEPIECES_BASE_URL.replace(/\/$/, '')}/api/v1/flags`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!flagsResponse.ok) {
          throw new Error(
            `Activepieces flags request failed with ${flagsResponse.status}`,
          );
        }

        const flags = (await flagsResponse.json()) as Record<string, unknown>;

        return {
          reachable: true,
          summary:
            'Activepieces API preflight succeeded via the instance flags endpoint.',
          projectCount: typeof flags.USER_CREATED === 'boolean' ? 1 : 0,
        };
      } catch {
        // Fall through to the primary project-list error below.
      }

      return {
        reachable: false,
        summary: `Activepieces API preflight failed: ${
          primaryError instanceof Error ? primaryError.message : 'unknown error'
        }`,
      };
    }
  }

  private resolveCredentialContext(): ActivepiecesCredentialContext {
    const token = this.env.ACTIVEPIECES_API_KEY.trim();

    if (token.startsWith('sk-')) {
      return {
        projectId: null,
        platformId: null,
        tokenType: 'service-key',
      };
    }

    const payload = this.decodeJwtPayload(token);
    const platform =
      payload &&
      typeof payload.platform === 'object' &&
      payload.platform !== null
        ? (payload.platform as Record<string, unknown>)
        : null;

    return {
      projectId:
        payload && typeof payload.projectId === 'string'
          ? payload.projectId
          : null,
      platformId:
        platform && typeof platform.id === 'string' ? platform.id : null,
      tokenType: payload ? 'jwt' : 'unknown',
    };
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    const payload = parts[1];

    if (!payload) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );

      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async assertRealDispatchReady(access: AccessContext) {
    const status = await this.getIntegrationStatus(access);
    const blockedDependencies = status.dependencies
      .filter((item) => item.state !== 'ready')
      .map((item) => item.code);

    if (blockedDependencies.length > 0) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Activepieces real dispatch is blocked by runtime readiness.',
        {
          blockedDependencies,
        },
      );
    }
  }

  private async dispatchSmokeCallbacks(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationTitle: string,
    runId: string,
    traceId: string,
    externalRunId: string | null,
    steps: readonly {
      readonly stepCode: string;
      readonly moduleCode: string;
      readonly status: 'queued';
      readonly requiresApproval: boolean;
      readonly errorCode: null;
    }[],
    mode: StartAutomationRunRequest['mode'],
    meta: RequestMeta,
  ) {
    const authorization = `Bearer ${this.buildCallbackToken(runId, traceId)}`;
    const occurredAt = () => new Date().toISOString();

    await this.handleRunEvent(
      {
        runId,
        externalRunId,
        eventType: 'running',
        error: null,
        idempotencyKey: `${runId}:smoke:run:running`,
        occurredAt: occurredAt(),
      },
      authorization,
    );

    for (const step of steps) {
      await this.handleStepEvent(
        {
          runId,
          externalRunId,
          stepCode: step.stepCode,
          moduleCode: step.moduleCode,
          eventType: 'completed',
          outputs: {
            smoke: true,
            workspaceId: access.activeWorkspace!.id,
            actorUserId: actor.id,
            requestId: meta.requestId,
          },
          error: null,
          idempotencyKey: `${runId}:${step.stepCode}:smoke:completed`,
          occurredAt: occurredAt(),
        },
        authorization,
      );
    }

    const artifact = await this.ingestRuntimeArtifact(runId, authorization, {
      artifactType: 'generated_document',
      title: `${automationTitle} smoke artifact`,
      mimeType: 'application/pdf',
      classification: 'client_material',
      source: 'activepieces_artifact',
    });

    if (mode === 'full_run') {
      await this.handleDeliveryGate(
        {
          runId,
          title: `${automationTitle} smoke delivery`,
          channel: 'email',
          subject: `${automationTitle} smoke result`,
          body: 'Smoke runtime completed and queued the result for delivery approval.',
          recipientEmails: ['sandbox@lexframe.local'],
          artifactIds: [artifact.id],
          requiresApproval: true,
          metadata: {
            smoke: true,
            traceId,
            actorUserId: actor.id,
            requestId: meta.requestId,
          },
          idempotencyKey: `${runId}:smoke:delivery_gate`,
          occurredAt: occurredAt(),
        },
        authorization,
      );
      return;
    }

    await this.handleRunEvent(
      {
        runId,
        externalRunId,
        eventType: 'completed',
        error: null,
        idempotencyKey: `${runId}:smoke:run:completed`,
        occurredAt: occurredAt(),
      },
      authorization,
    );
  }

  private async loadRunSmokeSummary(
    runId: string,
  ): Promise<ActivepiecesRunSmokeResponse> {
    const run = await this.databaseService.one<RunSmokeSummaryRow>(
      `
        select status, external_run_id, artifact_refs
        from app.workflow_runs
        where id = $1
        limit 1
      `,
      [runId],
    );

    if (!run) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        404,
        'Workflow run was not found after smoke execution.',
      );
    }

    const receiptRows =
      await this.databaseService.query<CallbackReceiptSummaryRow>(
        `
          select
            callback_type,
            count(*)::int as receipt_count,
            count(*) filter (where status = 'processed')::int as processed_count
          from app.activepieces_callback_receipts
          where workflow_run_id = $1
          group by callback_type
          order by callback_type asc
        `,
        [runId],
      );
    const received = receiptRows.rows.reduce(
      (total, row) => total + Number(row.receipt_count),
      0,
    );
    const processed = receiptRows.rows.reduce(
      (total, row) => total + Number(row.processed_count),
      0,
    );

    return {
      status: run.status,
      runId,
      externalRunId: run.external_run_id,
      artifactIds: run.artifact_refs ?? [],
      callbackReceiptSummary: {
        received,
        processed,
        types: receiptRows.rows.map((row) => row.callback_type),
      },
    };
  }

  private hashJson(value: unknown) {
    return this.hashValue(JSON.stringify(value));
  }

  private hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}

function mapRunEventType(
  status: ActivepiecesRunEventCallback['eventType'],
): string {
  if (status === 'completed') {
    return 'run.completed';
  }

  if (status === 'failed') {
    return 'run.failed';
  }

  return 'run.status.updated';
}

function validInputBindings(step: Record<string, unknown>) {
  const bindings = Array.isArray(step.input_bindings)
    ? step.input_bindings
    : [];
  return bindings.filter(
    (binding): binding is Record<string, unknown> =>
      isRecord(binding) &&
      (binding.validation_state === undefined ||
        binding.validation_state === 'valid' ||
        binding.validation_state === 'warning'),
  );
}

function bindingTarget(binding: Record<string, unknown>) {
  if (isRecord(binding.target)) {
    return {
      node_id:
        typeof binding.target.node_id === 'string'
          ? binding.target.node_id
          : typeof binding.targetNodeId === 'string'
            ? binding.targetNodeId
            : null,
      input_key:
        typeof binding.target.input_key === 'string'
          ? binding.target.input_key
          : typeof binding.targetInputKey === 'string'
            ? binding.targetInputKey
            : null,
    };
  }
  return {
    node_id:
      typeof binding.target_node_id === 'string'
        ? binding.target_node_id
        : typeof binding.targetNodeId === 'string'
          ? binding.targetNodeId
          : null,
    input_key:
      typeof binding.target_input_key === 'string'
        ? binding.target_input_key
        : typeof binding.targetInputKey === 'string'
          ? binding.targetInputKey
          : null,
  };
}

function redactRuntimeBindingSource(source: unknown): unknown {
  if (Array.isArray(source)) {
    return source.map(redactRuntimeBindingSource);
  }
  if (!isRecord(source)) {
    return source;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'value' || key === 'secret_ref') {
      redacted[key] = '[server_ref]';
      continue;
    }
    redacted[key] = redactRuntimeBindingSource(value);
  }
  return redacted;
}

function isUniqueConstraintError(error: unknown, constraint: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code =
    'code' in error && typeof error.code === 'string' ? error.code : null;
  const constraintName =
    'constraint' in error && typeof error.constraint === 'string'
      ? error.constraint
      : null;

  return code === '23505' && constraintName === constraint;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanvasWorkflowLike(value: unknown): value is LexFrameWorkflowV2 {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    isRecord(value.metadata) &&
    typeof value.schema_version === 'string'
  );
}
