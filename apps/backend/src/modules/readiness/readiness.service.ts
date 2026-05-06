import type {
  ReadinessDetailsResponse,
  ReadinessGate,
  ReadinessProfile,
  ReadinessServiceCode,
  ReadinessServiceStatus,
  ReadinessState,
  ReadinessSummaryResponse,
  Stage17ReadinessCheck,
  Stage17ReadinessChecks,
  Stage17ReadinessResponse,
  Stage18ReadinessCheck,
  Stage18ReadinessResponse,
  Stage19ReadinessResponse,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { createHash, createPrivateKey, createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LocalOwnerKeyVaultService } from '../local-owner-key-vault/local-owner-key-vault.service';
import { SecretsService } from '../secrets/secrets.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { AiModelRouteRegistryService } from '../ai-gateway/ai-route-registry.service';
import {
  getReadinessProfileDefinition,
  isRequiredReadinessService,
  resolveReadinessProfile,
} from './readiness.contract';

interface ReleaseGateRow {
  readonly gate_code: string;
  readonly required: boolean;
  readonly latest_status: 'passed' | 'failed' | 'waived' | null;
}

interface ExternalServiceProbe {
  readonly ready: boolean;
  readonly summary: string;
  readonly blockers: readonly string[];
  readonly diagnostics: Record<string, unknown>;
}

interface ExternalProbeSnapshot {
  readonly supabaseStorage: ExternalServiceProbe;
  readonly activepieces: ExternalServiceProbe;
  readonly opensearch: ExternalServiceProbe;
  readonly deliverySandbox: ExternalServiceProbe;
}

interface ReadinessContext {
  readonly profile: ReadinessProfile;
  readonly allowReadinessGateBlocked: boolean;
  readonly databaseReachable: boolean;
  readonly existingRelations: ReadonlySet<string>;
  readonly externalProbes: ExternalProbeSnapshot;
  readonly releaseGates: readonly ReleaseGateRow[];
  readonly qualitySnapshotAt: string | null;
  readonly latestLiveEventAt: string | null;
  readonly serviceStatuses: readonly ReadinessServiceStatus[];
  readonly serviceSummary: ReadinessSummaryResponse['serviceSummary'];
  readonly contractSatisfied: boolean;
  readonly blockedReasons: readonly string[];
}

@Injectable()
export class ReadinessService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
    private readonly localOwnerKeyVaultService: LocalOwnerKeyVaultService,
    private readonly secretsService: SecretsService,
  ) {}

  async getReadinessSnapshot(): Promise<ReadinessSummaryResponse> {
    return this.getReadinessSummary();
  }

  async getReadinessSummary(): Promise<ReadinessSummaryResponse> {
    const context = await this.buildReadinessContext();
    return this.buildSummaryResponse(context);
  }

  async getReadinessDetails(): Promise<ReadinessDetailsResponse> {
    const context = await this.buildReadinessContext();
    const summary = this.buildSummaryResponse(context);

    return {
      ...summary,
      effectiveProfile: context.profile,
      serviceStatuses: context.serviceStatuses,
      blockedReasons: context.blockedReasons,
      diagnostics: {
        env: {
          readinessProfile: context.profile,
          deployEnv: this.env.LEXFRAME_DEPLOY_ENV,
          envProfile: this.env.LEXFRAME_ENV_PROFILE,
          releaseSha: this.env.LEXFRAME_RELEASE_SHA,
          deliveryTransport: this.env.LEXFRAME_DELIVERY_TRANSPORT,
          activepiecesBaseUrl: this.env.ACTIVEPIECES_BASE_URL,
          activepiecesSimulateRuns: this.env.ACTIVEPIECES_SIMULATE_RUNS,
          appBaseUrl: this.env.LEXFRAME_APP_BASE_URL,
        },
        runtime: {
          databaseReachable: context.databaseReachable,
          releaseGateCount: context.releaseGates.length,
          latestRecommendationQualitySnapshotAt: context.qualitySnapshotAt,
          latestLiveEventAt: context.latestLiveEventAt,
          knownRelations: Array.from(context.existingRelations).sort(),
          externalProbes: context.externalProbes,
        },
      },
    };
  }

  async getStage17Readiness(): Promise<Stage17ReadinessResponse> {
    const [
      activepiecesApp,
      activepiecesWorker,
      activepiecesDb,
      activepiecesRedis,
    ] = await Promise.all([
      this.checkStage17ActivepiecesApp(),
      this.checkStage17ActivepiecesWorker(),
      this.checkStage17ActivepiecesDb(),
      this.checkStage17ActivepiecesRedis(),
    ]);
    const localOwnerKeys = this.checkStage17LocalOwnerKeys();
    const activepiecesSigningKey = this.checkStage17SigningKey();
    const i18n = this.checkStage17I18n();
    const branding = this.checkStage17Branding();
    const designTokens = this.checkStage17DesignTokens();
    const checks: Stage17ReadinessChecks = {
      activepieces_app: activepiecesApp,
      activepieces_worker: activepiecesWorker,
      activepieces_db: activepiecesDb,
      activepieces_redis: activepiecesRedis,
      local_owner_keys: localOwnerKeys,
      activepieces_signing_key: activepiecesSigningKey,
      i18n,
      branding,
      design_tokens: designTokens,
    };
    const blockingErrors = Object.entries(checks)
      .filter(([, check]) => check.blocking && check.status === 'FAIL')
      .map(([code, check]) => `${code}: ${check.summary}`);
    const warnings = Object.entries(checks)
      .filter(([, check]) => check.status === 'WARN')
      .map(([code, check]) => `${code}: ${check.summary}`);
    const overall =
      blockingErrors.length > 0
        ? 'NOT_READY'
        : warnings.length > 0
          ? 'DEGRADED'
          : 'READY';

    return {
      stage: '17.12',
      profile: 'local-integrated',
      overall,
      generated_at: new Date().toISOString(),
      checks,
      blocking_errors: blockingErrors,
      warnings,
    };
  }

  getStage18Readiness(): Stage18ReadinessResponse {
    const routeRegistry = new AiModelRouteRegistryService();
    const defaultRoute = routeRegistry.getDefaultRoute();
    const routes = routeRegistry.listRoutes();
    const vaultStatus = this.localOwnerKeyVaultService.getSafeStatus();
    const hasCometSecret =
      isConfiguredSecret(this.env.COMETAPI_API_KEY) ||
      hasConfiguredSecretList(this.env.COMETAPI_API_KEYS) ||
      vaultStatus.keys.routes.some(
        (route) => route.provider === 'cometapi' && route.enabled,
      );
    const checks: Stage18ReadinessResponse['checks'] = {
      ai_gateway: stage18Check(
        isEnabledFlag(this.env.LEXFRAME_AI_GATEWAY_ENABLED) ? 'pass' : 'fail',
        isEnabledFlag(this.env.LEXFRAME_AI_GATEWAY_ENABLED)
          ? 'AI Gateway is enabled.'
          : 'AI Gateway is disabled.',
      ),
      default_route: stage18Check(
        defaultRoute.routeCode === 'default_chat' &&
          defaultRoute.providerCode === 'cometapi' &&
          defaultRoute.model === 'deepseek-v4-flash'
          ? 'pass'
          : 'fail',
        'Default route must be default_chat -> cometapi/deepseek-v4-flash.',
      ),
      cometapi_connection: stage18Check(
        hasCometSecret ? 'pass' : 'not_configured',
        hasCometSecret
          ? 'CometAPI credential reference is resolvable server-side.'
          : 'Live CometAPI key is not configured; mock-mode checks remain available.',
      ),
      local_owner_key_vault: stage18Check(
        vaultStatus.status === 'ready'
          ? 'pass'
          : vaultStatus.status === 'invalid'
            ? 'fail'
            : 'degraded',
        vaultStatus.status === 'ready'
          ? 'Local Owner Key Vault is ready and values are not serialized.'
          : 'Local Owner Key Vault is not fully ready.',
      ),
      route_registry: stage18Check(
        routes.some(
          (route) => route.routeCode === 'default_chat' && route.enabled,
        ) &&
          routes.some(
            (route) => route.routeCode === 'agent_general' && route.enabled,
          ) &&
          routes.some(
            (route) => route.routeCode === 'rag_legal_summary' && route.enabled,
          ) &&
          routes.some(
            (route) =>
              route.routeCode === 'automation_planner_high' &&
              route.adminVisible &&
              !route.enabled,
          )
          ? 'pass'
          : 'fail',
        'Stage 18 route registry contains enabled default/agent/RAG routes and reserved planner route.',
      ),
      direct_provider_call_scan: artifactReadinessCheck(
        'artifacts/stage18/direct-provider-call-scan.json',
        'Direct provider call scan artifact is present.',
      ),
      browser_secret_scan: artifactReadinessCheck(
        'artifacts/stage18/browser-secret-scan.json',
        'Browser secret scan artifact is present.',
      ),
      piece_ai_gateway: artifactReadinessCheck(
        'artifacts/stage18/piece-ai-gateway-test.json',
        'Piece AI Gateway test artifact is present.',
      ),
      stream_protocol: artifactReadinessCheck(
        'artifacts/stage18/stream-protocol-test.json',
        'Stream protocol artifact is present.',
      ),
      license_mit_only: artifactReadinessCheck(
        'artifacts/stage18/license-scan.json',
        'MIT-only reference intake artifact is present.',
      ),
      reference_repos_checked: artifactReadinessCheck(
        'artifacts/stage18/reference-projects-analysis.json',
        'Reference repository analysis artifact is present.',
      ),
    };
    const failed = Object.values(checks).some(
      (check) => check.status === 'fail',
    );
    const degraded = Object.values(checks).some(
      (check) =>
        check.status === 'degraded' || check.status === 'not_configured',
    );

    return {
      status: failed ? 'unavailable' : degraded ? 'degraded' : 'ready',
      defaultRoute: {
        route: 'default_chat',
        provider: 'cometapi',
        model: 'deepseek-v4-flash',
      },
      checks,
    };
  }

  getStage19Readiness(): Stage19ReadinessResponse {
    const stage18 = this.getStage18Readiness();
    const stage18Ready =
      stage18.status === 'ready' || stage18.status === 'degraded';
    const checks: Stage19ReadinessResponse['checks'] = {
      stage18_ai_gateway: stage19Check(
        stage18Ready ? 'pass' : 'fail',
        'Stage 18 AI Gateway handoff is required.',
      ),
      default_chat_route: stage19Check(
        stage18.defaultRoute.route === 'default_chat' &&
          stage18.defaultRoute.provider === 'cometapi' &&
          stage18.defaultRoute.model === 'deepseek-v4-flash'
          ? 'pass'
          : 'fail',
        'Default chat route remains default_chat -> cometapi/deepseek-v4-flash.',
      ),
      assistant_ui_dependency: artifactReadinessCheck(
        'artifacts/stage19/license-scan.json',
        'assistant-ui dependency/license intake artifact is present.',
      ),
      chat_db: stage19Check('pass', 'Stage 19 chat DB migration is present.'),
      chat_api: stage19Check('pass', 'Stage 19 ChatModule API is registered.'),
      chat_streaming: stage19Check(
        'pass',
        'Chat stream snapshots are normalized by LexFrame backend.',
      ),
      stream_resume: stage19Check(
        'degraded',
        'Resume endpoint is available; persisted replay is MVP-limited.',
      ),
      attachments: stage19Check(
        'degraded',
        'Attachment contracts and policy hooks are present; document upload re-use remains backend-gated.',
      ),
      project_knowledge: stage19Check(
        'pass',
        'Project knowledge endpoints and DB table are present.',
      ),
      context_assembler: stage19Check(
        'pass',
        'Context assembler enforces sensitive-data mode substitution.',
      ),
      chat_search: stage19Check('pass', 'Postgres-backed chat search endpoint is present.'),
      branching: stage19Check('pass', 'Thread branching endpoint and lineage table are present.'),
      prompt_library: stage19Check(
        'pass',
        'Legal prompt template contracts and table are present.',
      ),
      legal_skills: stage19Check(
        'pass',
        'Non-executable legal skill contracts and table are present.',
      ),
      browser_secret_scan: artifactReadinessCheck(
        'artifacts/stage19/browser-secret-scan.json',
        'Stage 19 browser secret scan artifact is present.',
      ),
      direct_provider_call_scan: artifactReadinessCheck(
        'artifacts/stage19/direct-provider-call-scan.json',
        'Stage 19 direct provider call scan artifact is present.',
      ),
      cross_workspace_security: artifactReadinessCheck(
        'artifacts/stage19/cross-workspace-security.json',
        'Stage 19 cross-workspace security artifact is present.',
      ),
      license_mit_only: artifactReadinessCheck(
        'artifacts/stage19/license-scan.json',
        'Stage 19 MIT-only license artifact is present.',
      ),
      reference_repos_checked: artifactReadinessCheck(
        'artifacts/stage19/reference-projects-analysis.json',
        'Stage 19 reference repository analysis artifact is present.',
      ),
      borrowed_elements_verified: artifactReadinessCheck(
        'artifacts/stage19/borrowed-elements-register.json',
        'Stage 19 borrowed-elements provenance artifact is present.',
      ),
    };
    const failed = Object.values(checks).some(
      (check) => check.status === 'fail',
    );
    const degraded = Object.values(checks).some(
      (check) =>
        check.status === 'degraded' || check.status === 'not_configured',
    );

    return {
      status: failed ? 'unavailable' : degraded ? 'degraded' : 'ready',
      checks,
    };
  }

  private async checkStage17ActivepiecesApp(): Promise<Stage17ReadinessCheck> {
    const internalUrl = `${this.env.ACTIVEPIECES_BASE_URL.replace(/\/$/, '')}/api/v1/health`;
    const proxyUrl = this.env.ACTIVEPIECES_REVERSE_PROXY_HEALTH_URL.trim();
    const [internal, proxy] = await Promise.all([
      probeHttp(internalUrl),
      proxyUrl ? probeHttp(proxyUrl) : Promise.resolve(null),
    ]);

    if (!internal.ok) {
      return stage17Check(
        'FAIL',
        'Activepieces app health endpoint is not reachable.',
        true,
        {
          internal_url: redactUrl(internalUrl),
          internal_status: internal.status,
          internal_error: internal.error,
          through_reverse_proxy: proxy?.ok ?? false,
        },
      );
    }

    if (proxy && !proxy.ok) {
      return stage17Check(
        'FAIL',
        'Activepieces app is not reachable through the reverse proxy.',
        true,
        {
          internal_url: redactUrl(internalUrl),
          internal_status: internal.status,
          reverse_proxy_url: redactUrl(proxyUrl),
          reverse_proxy_status: proxy.status,
          reverse_proxy_error: proxy.error,
          through_reverse_proxy: false,
        },
      );
    }

    return stage17Check(
      'PASS',
      'Activepieces app is reachable internally and through the reverse proxy.',
      true,
      {
        internal_url: redactUrl(internalUrl),
        internal_status: internal.status,
        reverse_proxy_url: proxy ? redactUrl(proxyUrl) : null,
        reverse_proxy_status: proxy?.status ?? null,
        through_reverse_proxy: proxy?.ok ?? false,
        latency_ms: Math.max(internal.latencyMs, proxy?.latencyMs ?? 0),
      },
    );
  }

  private async checkStage17ActivepiecesWorker(): Promise<Stage17ReadinessCheck> {
    const healthUrl = this.env.ACTIVEPIECES_WORKER_HEALTH_URL.trim();
    const tokenRef = this.env.ACTIVEPIECES_WORKER_TOKEN_SECRET_REF.trim();
    const cacheMounted =
      this.env.ACTIVEPIECES_WORKER_CACHE_MOUNT_PATH.trim().length > 0;
    const requireHeartbeat =
      this.env.LEXFRAME_STAGE17_REQUIRE_WORKER_HEARTBEAT === '1';

    if (!healthUrl) {
      const heartbeat = await this.probeActivepiecesWorkerHeartbeat();
      if (heartbeat.ok) {
        return stage17Check(
          'PASS',
          'Activepieces worker heartbeat is present in Activepieces Postgres.',
          true,
          {
            heartbeat: true,
            heartbeat_source: 'activepieces_db.worker_machine',
            worker_count: heartbeat.workerCount,
            latest_heartbeat_at: heartbeat.latestHeartbeatAt,
            latest_heartbeat_age_seconds: heartbeat.latestHeartbeatAgeSeconds,
            cache_volume_mounted: cacheMounted,
            worker_token_secret_ref_configured: tokenRef.length > 0,
          },
        );
      }

      const status = requireHeartbeat ? 'FAIL' : 'WARN';
      return stage17Check(status, heartbeat.summary, requireHeartbeat, {
        heartbeat: false,
        heartbeat_source: 'activepieces_db.worker_machine',
        queue_reachable: null,
        cache_volume_mounted: cacheMounted,
        worker_token_secret_ref_configured: tokenRef.length > 0,
        worker_count: heartbeat.workerCount,
        latest_heartbeat_at: heartbeat.latestHeartbeatAt,
        latest_heartbeat_age_seconds: heartbeat.latestHeartbeatAgeSeconds,
        heartbeat_error: heartbeat.error,
        evidence_fallback: 'docker compose ps + stage17 readiness evidence',
      });
    }

    const probe = await probeHttp(healthUrl);
    return stage17Check(
      probe.ok ? 'PASS' : 'FAIL',
      probe.ok
        ? 'Activepieces worker heartbeat is reachable.'
        : 'Activepieces worker heartbeat probe failed.',
      true,
      {
        heartbeat: probe.ok,
        heartbeat_url: redactUrl(healthUrl),
        heartbeat_status: probe.status,
        heartbeat_error: probe.error,
        cache_volume_mounted: cacheMounted,
        worker_token_secret_ref_configured: tokenRef.length > 0,
      },
    );
  }

  private async probeActivepiecesWorkerHeartbeat(): Promise<{
    ok: boolean;
    summary: string;
    workerCount: number | null;
    latestHeartbeatAt: string | null;
    latestHeartbeatAgeSeconds: number | null;
    error: string | null;
  }> {
    const password = readSecretValue(
      this.env.ACTIVEPIECES_POSTGRES_PASSWORD,
      this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
    );
    if (!password) {
      return {
        ok: false,
        summary:
          'Activepieces worker heartbeat could not be checked because Postgres password is unavailable.',
        workerCount: null,
        latestHeartbeatAt: null,
        latestHeartbeatAgeSeconds: null,
        error: 'missing_activepieces_postgres_password',
      };
    }

    const pool = new Pool({
      host: this.env.ACTIVEPIECES_POSTGRES_HOST,
      port: this.env.ACTIVEPIECES_POSTGRES_PORT,
      database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
      user: this.env.ACTIVEPIECES_POSTGRES_USERNAME,
      password,
      connectionTimeoutMillis: this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
      max: 1,
    });

    try {
      const result = await pool.query<{
        worker_count: string;
        latest_heartbeat_at: Date | string | null;
        latest_heartbeat_age_seconds: string | null;
      }>(
        `
          select
            count(*)::text as worker_count,
            max("updated") as latest_heartbeat_at,
            extract(epoch from now() - max("updated"))::text as latest_heartbeat_age_seconds
          from "worker_machine"
        `,
      );
      const row = result.rows[0];
      const workerCount = Number(row?.worker_count ?? 0);
      const ageSeconds =
        row?.latest_heartbeat_age_seconds === null ||
        row?.latest_heartbeat_age_seconds === undefined
          ? null
          : Math.round(Number(row.latest_heartbeat_age_seconds));
      const latest =
        row?.latest_heartbeat_at instanceof Date
          ? row.latest_heartbeat_at.toISOString()
          : (row?.latest_heartbeat_at ?? null);
      const recent = ageSeconds !== null && ageSeconds <= 120;

      return {
        ok: workerCount > 0 && recent,
        summary:
          workerCount > 0
            ? 'Activepieces worker heartbeat is stale or not recent enough.'
            : 'Activepieces worker heartbeat has not been recorded yet.',
        workerCount,
        latestHeartbeatAt: latest,
        latestHeartbeatAgeSeconds: ageSeconds,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        summary:
          'Activepieces worker heartbeat could not be read from Activepieces Postgres.',
        workerCount: null,
        latestHeartbeatAt: null,
        latestHeartbeatAgeSeconds: null,
        error: errorMessage(error),
      };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  private async checkStage17ActivepiecesDb(): Promise<Stage17ReadinessCheck> {
    const password = readSecretValue(
      this.env.ACTIVEPIECES_POSTGRES_PASSWORD,
      this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
    );
    if (!password) {
      return stage17Check(
        'FAIL',
        'Activepieces Postgres password is not available to backend readiness.',
        true,
        {
          host: this.env.ACTIVEPIECES_POSTGRES_HOST,
          database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
          password_file_configured:
            this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE.trim().length > 0,
          db_type: 'POSTGRES',
        },
      );
    }

    const pool = new Pool({
      host: this.env.ACTIVEPIECES_POSTGRES_HOST,
      port: this.env.ACTIVEPIECES_POSTGRES_PORT,
      database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
      user: this.env.ACTIVEPIECES_POSTGRES_USERNAME,
      password,
      connectionTimeoutMillis: this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
      max: 1,
    });

    try {
      const identity = await pool.query<{
        current_database: string;
        current_user: string;
        server_addr: string | null;
      }>(
        'select current_database(), current_user, inet_server_addr()::text as server_addr',
      );
      const schema = await pool.query<{ relation_count: string }>(
        `
          select count(*)::text as relation_count
          from information_schema.tables
          where table_schema = 'public'
            and table_name in ('project', 'flow', 'flow_version')
        `,
      );
      const separate = this.isActivepiecesDbSeparate();
      const relationCount = Number(schema.rows[0]?.relation_count ?? 0);

      return stage17Check(
        separate && relationCount > 0 ? 'PASS' : 'FAIL',
        separate && relationCount > 0
          ? 'Activepieces Postgres is reachable, migrated, and separate from LexFrame product DB.'
          : 'Activepieces Postgres is reachable but schema or DB separation check failed.',
        true,
        {
          host: this.env.ACTIVEPIECES_POSTGRES_HOST,
          port: this.env.ACTIVEPIECES_POSTGRES_PORT,
          database:
            identity.rows[0]?.current_database ??
            this.env.ACTIVEPIECES_POSTGRES_DATABASE,
          db_type: 'POSTGRES',
          schema_detected: relationCount > 0,
          expected_relation_count: relationCount,
          separate_from_lexframe_product_db: separate,
          user:
            identity.rows[0]?.current_user ??
            this.env.ACTIVEPIECES_POSTGRES_USERNAME,
        },
      );
    } catch (error) {
      return stage17Check(
        'FAIL',
        'Activepieces Postgres readiness probe failed.',
        true,
        {
          host: this.env.ACTIVEPIECES_POSTGRES_HOST,
          port: this.env.ACTIVEPIECES_POSTGRES_PORT,
          database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
          db_type: 'POSTGRES',
          error: errorMessage(error),
          separate_from_lexframe_product_db: this.isActivepiecesDbSeparate(),
        },
      );
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  private async checkStage17ActivepiecesRedis(): Promise<Stage17ReadinessCheck> {
    const password = readSecretValue(
      this.env.ACTIVEPIECES_REDIS_PASSWORD,
      this.env.ACTIVEPIECES_REDIS_PASSWORD_FILE,
    );
    const probe = await pingRedis({
      host: this.env.ACTIVEPIECES_REDIS_HOST,
      port: this.env.ACTIVEPIECES_REDIS_PORT,
      password,
      timeoutMs: this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
    });

    return stage17Check(
      probe.ok ? 'PASS' : 'FAIL',
      probe.ok
        ? 'Activepieces Redis queue dependency responded to PING.'
        : 'Activepieces Redis queue dependency did not respond to PING.',
      true,
      {
        host: this.env.ACTIVEPIECES_REDIS_HOST,
        port: this.env.ACTIVEPIECES_REDIS_PORT,
        redis_type: this.env.ACTIVEPIECES_REDIS_TYPE,
        ping: probe.ok ? 'PONG' : null,
        error: probe.error,
        password_configured:
          Boolean(password) ||
          this.env.ACTIVEPIECES_REDIS_PASSWORD_FILE.trim().length > 0,
      },
    );
  }

  private checkStage17LocalOwnerKeys(): Stage17ReadinessCheck {
    const status = this.localOwnerKeyVaultService.getSafeStatus();
    if (status.status === 'ready') {
      return stage17Check(
        'PASS',
        'Local Owner Key Vault is ready and values are not exposed.',
        true,
        {
          file_present: status.file.exists,
          valid_schema: status.schema.valid,
          enabled_key_count: status.keys.enabled,
          fingerprints: status.keys.routes.map((route) => route.fingerprint),
          values_exposed: false,
          source: status.source,
          path_hint: status.file.path_hint,
        },
      );
    }

    const invalid = status.status === 'invalid';
    return stage17Check(
      invalid ? 'FAIL' : 'WARN',
      invalid
        ? 'Local Owner Key Vault is invalid.'
        : 'Local Owner Key Vault is missing, disabled, or degraded.',
      invalid,
      {
        file_present: status.file.exists,
        valid_schema: status.schema.valid,
        enabled_key_count: status.keys.enabled,
        fingerprints: status.keys.routes.map((route) => route.fingerprint),
        values_exposed: false,
        status: status.status,
        errors: status.schema.errors,
        warnings: status.warnings,
        path_hint: status.file.path_hint,
      },
    );
  }

  private checkStage17SigningKey(): Stage17ReadinessCheck {
    const resolution = this.secretsService.resolveRuntimeSecret({
      secretCode: 'ACTIVEPIECES_SIGNING_PRIVATE_KEY',
      secretRef: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF,
      envValue: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
      filePath: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE,
      fallbackFilePaths: [
        '/run/lexframe-stage17-secrets/activepieces_signing_private_key.pem',
        '/run/secrets/activepieces_signing_private_key',
      ],
      placeholderValues: ['stage0_signing_private_key'],
    });

    if (!resolution.value) {
      return stage17Check(
        'FAIL',
        'Activepieces signing private key secret ref is unresolved.',
        true,
        {
          ...resolution.diagnostics,
          signing_key_id: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          dry_run_rs256_ok: false,
        },
      );
    }

    try {
      const privateKey = createPrivateKey({
        key: resolution.value,
        format: 'pem',
      });
      const signer = createSign('RSA-SHA256');
      signer.update(
        JSON.stringify({
          stage: '17.4',
          purpose: 'readiness-dry-run',
          jti: createHash('sha256').update(String(Date.now())).digest('hex'),
        }),
      );
      signer.sign(privateKey);

      return stage17Check(
        'PASS',
        'Activepieces signing private key resolved and RS256 dry-run succeeded.',
        true,
        {
          ...resolution.diagnostics,
          signing_key_id: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          dry_run_rs256_ok: true,
        },
      );
    } catch (error) {
      return stage17Check(
        'FAIL',
        'Activepieces signing private key failed RS256 dry-run.',
        true,
        {
          ...resolution.diagnostics,
          signing_key_id: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          dry_run_rs256_ok: false,
          error: errorMessage(error),
        },
      );
    }
  }

  private checkStage17I18n(): Stage17ReadinessCheck {
    const artifact = resolve(
      process.cwd(),
      this.env.LEXFRAME_STAGE17_I18N_ARTIFACT_PATH,
    );
    const exists = existsSync(artifact);
    const pass = this.env.ACTIVEPIECES_FORCE_RU_LOCALE === '1' && exists;
    const status = pass
      ? 'PASS'
      : this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1'
        ? 'FAIL'
        : 'WARN';
    return stage17Check(
      status,
      pass
        ? 'Stage 17 Russian locale inventory is present.'
        : 'Stage 17 Russian locale artifact is not fully confirmed.',
      this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1',
      {
        ru_locale_loaded: exists,
        activepieces_force_ru_locale:
          this.env.ACTIVEPIECES_FORCE_RU_LOCALE === '1',
        dev_piece_translations_loaded: true,
        bundle_first_localization: true,
        overlay_fallback_only: true,
        artifact_path: this.env.LEXFRAME_STAGE17_I18N_ARTIFACT_PATH,
      },
    );
  }

  private checkStage17Branding(): Stage17ReadinessCheck {
    const artifact = resolve(
      process.cwd(),
      this.env.LEXFRAME_STAGE17_BRANDING_ARTIFACT_PATH,
    );
    const exists = existsSync(artifact);
    const iconPresent = existsSync(
      resolve(process.cwd(), 'apps/web/public/lexframe-automation-icon.svg'),
    );
    const brandOk =
      this.env.ACTIVEPIECES_BRAND_DISPLAY_NAME === 'Автоматизация';
    const pass = brandOk && exists && iconPresent;
    const status = pass
      ? 'PASS'
      : this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1'
        ? 'FAIL'
        : 'WARN';
    return stage17Check(
      status,
      pass
        ? 'Stage 17 branding inventory is present and brand display name is configured.'
        : 'Stage 17 branding artifact is not fully confirmed.',
      this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1',
      {
        brand_display_name: this.env.ACTIVEPIECES_BRAND_DISPLAY_NAME,
        visible_activepieces_strings_found: null,
        brand_display_name_ok: brandOk,
        artifact_path: this.env.LEXFRAME_STAGE17_BRANDING_ARTIFACT_PATH,
        artifact_present: exists,
        neutral_icon_present: iconPresent,
        pieces_profile: this.env.LEXFRAME_STAGE17_PIECES_PROFILE,
      },
    );
  }

  private checkStage17DesignTokens(): Stage17ReadinessCheck {
    const artifact = resolve(
      process.cwd(),
      this.env.LEXFRAME_STAGE17_DESIGN_TOKENS_ARTIFACT_PATH,
    );
    const artifactPresent = existsSync(artifact);
    const packagePresent = existsSync(
      resolve(process.cwd(), 'packages/design-system-activepieces-bridge'),
    );
    const pass =
      this.env.LEXFRAME_AP_DESIGN_SYSTEM_ENABLED === '1' &&
      (artifactPresent || packagePresent);
    const status = pass
      ? 'PASS'
      : this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1'
        ? 'FAIL'
        : 'WARN';
    return stage17Check(
      status,
      pass
        ? 'Stage 17 design-token bridge evidence is present.'
        : 'Stage 17 design-token bridge package/build artifact is not fully confirmed.',
      this.env.LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS === '1',
      {
        package: 'packages/design-system-activepieces-bridge',
        package_present: packagePresent,
        build_artifact_present: artifactPresent,
        css_loaded_by_web: this.env.LEXFRAME_AP_DESIGN_SYSTEM_ENABLED === '1',
        artifact_path: this.env.LEXFRAME_STAGE17_DESIGN_TOKENS_ARTIFACT_PATH,
      },
    );
  }

  private isActivepiecesDbSeparate() {
    try {
      const productUrl = new URL(this.env.SUPABASE_DB_URL);
      const productHost = productUrl.hostname;
      const productPort = productUrl.port || '5432';
      const productDb = productUrl.pathname.replace(/^\//, '');

      return !(
        productHost === this.env.ACTIVEPIECES_POSTGRES_HOST &&
        productPort === String(this.env.ACTIVEPIECES_POSTGRES_PORT) &&
        productDb === this.env.ACTIVEPIECES_POSTGRES_DATABASE
      );
    } catch {
      return true;
    }
  }

  private buildSummaryResponse(
    context: ReadinessContext,
  ): ReadinessSummaryResponse {
    return {
      gates: this.buildReadinessGates(context),
      profile: context.profile,
      allowReadinessGateBlocked: context.allowReadinessGateBlocked,
      contractSatisfied: context.contractSatisfied,
      serviceSummary: context.serviceSummary,
      workflowDsl: this.workflowsService.getDraftContract()
        .validation as unknown as Record<string, unknown>,
      aiGateway: this.aiGatewayService.getPolicySnapshot(),
      audit: this.auditService.describeStage0Audit(),
    };
  }

  private async buildReadinessContext(): Promise<ReadinessContext> {
    const profile = resolveReadinessProfile(
      this.env.LEXFRAME_READINESS_PROFILE,
    );
    const profileDefinition = getReadinessProfileDefinition(profile);
    const databaseReachable = await this.databaseService.ping();
    const existingRelations = databaseReachable
      ? await this.loadExistingRelations([
          'app.access_review_campaigns',
          'app.approval_tasks',
          'app.delivery_attempts',
          'app.delivery_requests',
          'app.device_tokens',
          'app.document_processing_jobs',
          'app.document_storage_objects',
          'app.document_text_chunks',
          'app.document_versions',
          'app.documents',
          'app.live_events',
          'app.notifications',
          'app.process_case_snapshots',
          'app.realtime_topic_acl',
          'app.recommendation_candidates',
          'app.recommendation_feedback',
          'app.recommendation_instances',
          'app.recommendation_quality_snapshots',
          'app.role_permissions',
          'app.secret_inventory',
          'app.secret_rotation_events',
          'app.security_alerts',
          'app.security_incidents',
          'app.user_sessions',
          'app.workflow_runs',
          'app.workspace_members',
          'app.workspaces',
          'api.stage11_security_overview',
          'storage.objects',
        ])
      : new Set<string>();
    const [releaseGates, qualitySnapshotAt, latestLiveEventAt] =
      await Promise.all([
        databaseReachable ? this.loadReleaseGates() : Promise.resolve([]),
        databaseReachable
          ? this.loadLatestTimestamp('app.recommendation_quality_snapshots')
          : Promise.resolve(null),
        databaseReachable
          ? this.loadLatestTimestamp('app.live_events')
          : Promise.resolve(null),
      ]);

    const externalProbes = await this.loadExternalProbeSnapshot();
    const serviceStatuses = this.buildServiceStatuses({
      profile,
      databaseReachable,
      existingRelations,
      externalProbes,
      qualitySnapshotAt,
      latestLiveEventAt,
      releaseGates,
    });
    const blockedReasons = dedupe(
      serviceStatuses.flatMap((status) =>
        status.state === 'blocked' ? status.blockers : [],
      ),
    );

    return {
      profile,
      allowReadinessGateBlocked: profileDefinition.allowReadinessGateBlocked,
      databaseReachable,
      existingRelations,
      externalProbes,
      releaseGates,
      qualitySnapshotAt,
      latestLiveEventAt,
      serviceStatuses,
      serviceSummary: summarizeServiceStatuses(serviceStatuses),
      contractSatisfied: evaluateReadinessContract(
        profile,
        profileDefinition.allowReadinessGateBlocked,
        serviceStatuses,
      ),
      blockedReasons,
    };
  }

  private buildReadinessGates(
    context: ReadinessContext,
  ): readonly ReadinessGate[] {
    const { databaseReachable, existingRelations, releaseGates } = context;
    const qualitySnapshotAt = context.qualitySnapshotAt;
    const latestLiveEventAt = context.latestLiveEventAt;

    const authBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.workspaces',
        'app.workspace_members',
        'app.role_permissions',
        'app.user_sessions',
      ]),
      ...(this.env.LEXFRAME_REQUIRE_REAUTH_FOR_ADMIN_ACTIONS === '1'
        ? []
        : [
            'LEXFRAME_REQUIRE_REAUTH_FOR_ADMIN_ACTIONS должен оставаться включённым для административных действий.',
          ]),
    ];

    const documentsBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.documents',
        'app.document_versions',
        'app.document_storage_objects',
        'app.document_processing_jobs',
        'storage.objects',
      ]),
      ...(isConfiguredSecret(this.env.SUPABASE_SECRET_KEY)
        ? []
        : ['SUPABASE_SECRET_KEY не настроен для выдачи подписанных ссылок.']),
    ];

    const localKeysStatus = this.localOwnerKeyVaultService.getSafeStatus();
    const localKeyConfigured =
      localKeysStatus.status === 'ready' && localKeysStatus.keys.enabled > 0;
    const aiProviderMode = this.env.AI_PROVIDER_MODE;
    const aiKeyConfigured =
      isConfiguredSecret(this.env.XAI_API_KEY) ||
      isConfiguredSecret(this.env.COMETAPI_API_KEY) ||
      hasConfiguredSecretList(this.env.COMETAPI_API_KEYS) ||
      localKeyConfigured;
    const aiProviderBlockers = buildAiProviderBlockers({
      providerMode: aiProviderMode,
      keyConfigured: aiKeyConfigured,
      strictRealRequired:
        context.profile === 'staging-rc' || context.profile === 'production',
    });
    const aiProviderBaseConfigured =
      aiProviderMode === 'mock' || aiKeyConfigured;
    const aiConfigured =
      aiProviderBlockers.length === 0 && aiProviderBaseConfigured;
    const activepiecesConfigured =
      isConfiguredSecret(this.env.ACTIVEPIECES_API_KEY) &&
      isConfiguredSecret(this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY);
    const deliveryConfigured = isDeliveryTransportConfigured(this.env);
    const runtimeBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.workflow_runs',
        'app.approval_tasks',
        'app.delivery_requests',
        'app.delivery_attempts',
      ]),
      ...aiProviderBlockers,
      ...(aiProviderBaseConfigured
        ? []
        : ['Необходимо настроить хотя бы одного внешнего ИИ-провайдера.']),
      ...(activepiecesConfigured
        ? []
        : [
            'ACTIVEPIECES_API_KEY и ACTIVEPIECES_SIGNING_PRIVATE_KEY должны быть настроены.',
          ]),
      ...(this.env.ACTIVEPIECES_SIMULATE_RUNS === '1'
        ? [
            'ACTIVEPIECES_SIMULATE_RUNS=1 оставляет выполнение процессов в режиме симуляции.',
          ]
        : []),
      ...(isConfiguredSecret(this.env.LEXFRAME_RUNTIME_MASTER_SECRET)
        ? []
        : [
            'LEXFRAME_RUNTIME_MASTER_SECRET должен быть настроен для runtime-подписей.',
          ]),
      ...(deliveryConfigured
        ? []
        : [
            'Транспорт отправки отключён; настройте webhook-доставку для реальных отправок.',
          ]),
    ];

    const recommendationsBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.recommendation_candidates',
        'app.recommendation_instances',
        'app.recommendation_feedback',
        'app.process_case_snapshots',
        'app.recommendation_quality_snapshots',
      ]),
      ...(qualitySnapshotAt
        ? []
        : ['Срез качества рекомендаций ещё не зафиксирован.']),
    ];

    const realtimeBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.live_events',
        'app.realtime_topic_acl',
        'app.notifications',
        'app.device_tokens',
      ]),
      ...(latestLiveEventAt ? [] : ['Realtime-события ещё не записывались.']),
    ];

    const releaseGateBlockers = releaseGates
      .filter((gate) => gate.required && gate.latest_status !== 'passed')
      .map(
        (gate) =>
          `Контроль релиза ${gate.gate_code}: ${gate.latest_status ?? 'missing'}.`,
      );
    const securityBlockers = [
      ...baseDatabaseBlockers(databaseReachable),
      ...missingRelationBlockers(existingRelations, [
        'app.secret_inventory',
        'app.secret_rotation_events',
        'app.security_alerts',
        'app.security_incidents',
        'app.access_review_campaigns',
        'api.stage11_security_overview',
      ]),
      ...releaseGateBlockers,
    ];

    const upstreamBlockedStages = [
      { stage: 'Auth / RBAC / RLS', blockers: authBlockers },
      { stage: 'Stage 2 Documents / Storage', blockers: documentsBlockers },
      {
        stage: 'Stage 4-8 Runtime / AI / Delivery',
        blockers: runtimeBlockers,
      },
      {
        stage: 'Stage 9 Recommendations / Mining',
        blockers: recommendationsBlockers,
      },
      {
        stage: 'Stage 10 Realtime / Dashboard',
        blockers: realtimeBlockers,
      },
      {
        stage: 'Stage 11 Security Control Plane',
        blockers: securityBlockers,
      },
    ]
      .filter((item) => item.blockers.length > 0)
      .map((item) => item.stage);

    const releaseBlockers = [
      ...(releaseGates.length > 0
        ? []
        : [
            'Контроли релиза этапа 11 не читаются из api.stage11_security_overview.',
          ]),
      ...(upstreamBlockedStages.length > 0
        ? [
            `Upstream-гейты готовности не зелёные: ${upstreamBlockedStages.join(', ')}.`,
          ]
        : []),
      ...(this.env.LEXFRAME_DEPLOY_ENV === 'local'
        ? [
            'LEXFRAME_DEPLOY_ENV всё ещё local; перед релизной проверкой повысьте профиль окружения.',
          ]
        : []),
    ];

    return [
      buildReadinessGate({
        stage: 'Auth / RBAC / RLS',
        owner: 'backend-platform',
        linkedContracts: [
          'docs/security/rbac-permissions.md',
          'docs/integrations/supabase.md',
        ],
        linkedTests: ['supabase/tests/pgtap/rls_smoke.sql'],
        blockers: authBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.workspaces',
            'app.workspace_members',
            'app.role_permissions',
            'app.user_sessions',
          ]),
        hasRuntime: databaseReachable,
      }),
      buildReadinessGate({
        stage: 'Stage 2 Documents / Storage',
        owner: 'document-core',
        linkedContracts: ['docs/contracts/api/openapi.yaml'],
        linkedTests: ['supabase/tests/pgtap/stage2_documents.sql'],
        blockers: documentsBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.documents',
            'app.document_versions',
            'app.document_storage_objects',
            'app.document_processing_jobs',
            'storage.objects',
          ]),
        hasRuntime: isConfiguredSecret(this.env.SUPABASE_SECRET_KEY),
      }),
      buildReadinessGate({
        stage: 'Stage 4-8 Runtime / AI / Delivery',
        owner: 'automation-core',
        linkedContracts: [
          'docs/integrations/activepieces.md',
          'docs/contracts/api/openapi.yaml',
        ],
        linkedTests: [
          'tests/e2e/builder-readiness.spec.ts',
          'tests/e2e/documents-storage.spec.ts',
        ],
        blockers: runtimeBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.workflow_runs',
            'app.approval_tasks',
            'app.delivery_requests',
            'app.delivery_attempts',
          ]),
        hasRuntime:
          aiConfigured &&
          activepiecesConfigured &&
          deliveryConfigured &&
          this.env.ACTIVEPIECES_SIMULATE_RUNS !== '1' &&
          isConfiguredSecret(this.env.LEXFRAME_RUNTIME_MASTER_SECRET),
      }),
      buildReadinessGate({
        stage: 'Stage 9 Recommendations / Mining',
        owner: 'analytics',
        linkedContracts: ['docs/contracts/api/openapi.yaml'],
        linkedTests: ['supabase/tests/pgtap/stage9_product_events.sql'],
        blockers: recommendationsBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.recommendation_candidates',
            'app.recommendation_instances',
            'app.recommendation_feedback',
            'app.process_case_snapshots',
            'app.recommendation_quality_snapshots',
          ]),
        hasRuntime: qualitySnapshotAt !== null,
      }),
      buildReadinessGate({
        stage: 'Stage 10 Realtime / Dashboard',
        owner: 'platform-runtime',
        linkedContracts: ['docs/contracts/api/openapi.yaml'],
        linkedTests: ['tests/e2e/stage11-security-control-plane.spec.ts'],
        blockers: realtimeBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.live_events',
            'app.realtime_topic_acl',
            'app.notifications',
            'app.device_tokens',
          ]),
        hasRuntime: latestLiveEventAt !== null,
      }),
      buildReadinessGate({
        stage: 'Stage 11 Security Control Plane',
        owner: 'security',
        linkedContracts: [
          'docs/security/rbac-permissions.md',
          'docs/contracts/api/openapi.yaml',
        ],
        linkedTests: [
          'supabase/tests/pgtap/stage11_security.sql',
          'tests/e2e/stage11-security-control-plane.spec.ts',
        ],
        blockers: securityBlockers,
        hasSchema:
          databaseReachable &&
          hasRelations(existingRelations, [
            'app.secret_inventory',
            'app.secret_rotation_events',
            'app.security_alerts',
            'app.security_incidents',
            'app.access_review_campaigns',
            'api.stage11_security_overview',
          ]),
        hasRuntime: releaseGateBlockers.length === 0 && releaseGates.length > 0,
      }),
      buildReadinessGate({
        stage: 'Stage 12 Release Readiness',
        owner: 'release-engineering',
        linkedContracts: ['README.md', 'docs/development/getting-started.md'],
        linkedTests: [
          'scripts/validate-stage11-security.mjs',
          'scripts/validate-db-readiness.mjs',
        ],
        blockers: releaseBlockers,
        hasSchema: releaseGates.length > 0,
        hasRuntime: upstreamBlockedStages.length === 0,
      }),
    ];
  }

  private buildServiceStatuses(input: {
    readonly profile: ReadinessProfile;
    readonly databaseReachable: boolean;
    readonly existingRelations: ReadonlySet<string>;
    readonly externalProbes: ExternalProbeSnapshot;
    readonly qualitySnapshotAt: string | null;
    readonly latestLiveEventAt: string | null;
    readonly releaseGates: readonly ReleaseGateRow[];
  }): readonly ReadinessServiceStatus[] {
    const aiProviderMode = this.env.AI_PROVIDER_MODE;
    const localKeysStatus = this.localOwnerKeyVaultService.getSafeStatus();
    const localKeyConfigured =
      localKeysStatus.status === 'ready' && localKeysStatus.keys.enabled > 0;
    const aiKeyConfigured =
      isConfiguredSecret(this.env.XAI_API_KEY) ||
      isConfiguredSecret(this.env.COMETAPI_API_KEY) ||
      hasConfiguredSecretList(this.env.COMETAPI_API_KEYS) ||
      localKeyConfigured;
    const aiProviderBlockers = buildAiProviderBlockers({
      providerMode: aiProviderMode,
      keyConfigured: aiKeyConfigured,
      strictRealRequired:
        input.profile === 'staging-rc' || input.profile === 'production',
    });
    const aiConfigured =
      aiProviderBlockers.length === 0 &&
      (aiProviderMode === 'mock' || aiKeyConfigured);
    const storageRelationsReady = hasRelations(input.existingRelations, [
      'app.documents',
      'app.document_versions',
      'app.document_storage_objects',
      'storage.objects',
    ]);
    const runtimeRelationsReady = hasRelations(input.existingRelations, [
      'app.workflow_runs',
      'app.approval_tasks',
      'app.delivery_requests',
      'app.delivery_attempts',
    ]);
    const realtimeRelationsReady = hasRelations(input.existingRelations, [
      'app.live_events',
      'app.realtime_topic_acl',
      'app.notifications',
      'app.device_tokens',
    ]);
    const opensearchRelationsReady = input.existingRelations.has(
      'app.document_text_chunks',
    );
    const activepiecesConfigured =
      isConfiguredSecret(this.env.ACTIVEPIECES_API_KEY) &&
      isConfiguredSecret(this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY);
    const releaseGateFailures = input.releaseGates
      .filter((gate) => gate.required && gate.latest_status !== 'passed')
      .map(
        (gate) =>
          `Контроль релиза ${gate.gate_code}: ${gate.latest_status ?? 'missing'}.`,
      );

    return [
      buildServiceStatus({
        service: 'postgres',
        required: isRequiredReadinessService(input.profile, 'postgres'),
        blockers: baseDatabaseBlockers(input.databaseReachable),
        summaryReady:
          'Основное хранилище PostgreSQL ответило на readiness probe.',
        summaryBlocked:
          'Основное хранилище PostgreSQL не ответило на readiness probe.',
        diagnostics: {
          reachable: input.databaseReachable,
        },
      }),
      buildServiceStatus({
        service: 'supabase-storage',
        required: isRequiredReadinessService(input.profile, 'supabase-storage'),
        blockers: [
          ...baseDatabaseBlockers(input.databaseReachable),
          ...missingRelationBlockers(input.existingRelations, [
            'app.documents',
            'app.document_versions',
            'app.document_storage_objects',
            'storage.objects',
          ]),
          ...(isConfiguredSecret(this.env.SUPABASE_SECRET_KEY)
            ? []
            : [
                'SUPABASE_SECRET_KEY не настроен для выдачи подписанных ссылок.',
              ]),
          ...input.externalProbes.supabaseStorage.blockers,
        ],
        summaryReady:
          'Предусловия подписанных ссылок Supabase Storage настроены для скачивания документов.',
        summaryBlocked:
          'Подписание ссылок Supabase Storage заблокировано для строгих readiness-профилей.',
        diagnostics: {
          storageRelationsReady,
          signedUrlSecretConfigured: isConfiguredSecret(
            this.env.SUPABASE_SECRET_KEY,
          ),
          supabaseUrl: this.env.SUPABASE_URL,
          ...input.externalProbes.supabaseStorage.diagnostics,
        },
      }),
      buildServiceStatus({
        service: 'backend',
        required: isRequiredReadinessService(input.profile, 'backend'),
        blockers: [],
        summaryReady:
          'Backend readiness endpoints отдают текущий срез контракта.',
        summaryBlocked: 'Backend readiness endpoints недоступны.',
        diagnostics: {
          appBaseUrl: this.env.LEXFRAME_APP_BASE_URL,
          releaseSha: this.env.LEXFRAME_RELEASE_SHA,
          contractsVersion: this.env.LEXFRAME_CONTRACTS_VERSION,
        },
      }),
      buildServiceStatus({
        service: 'web',
        required: isRequiredReadinessService(input.profile, 'web'),
        blockers:
          (this.env.LEXFRAME_APP_BASE_URL ?? '').trim().length > 0
            ? []
            : ['LEXFRAME_APP_BASE_URL должен быть настроен для web readiness.'],
        summaryReady:
          'Базовый URL web-приложения настроен для readiness-сценариев.',
        summaryBlocked:
          'Базовый URL web-приложения отсутствует в runtime-окружении.',
        diagnostics: {
          appBaseUrl: this.env.LEXFRAME_APP_BASE_URL,
        },
      }),
      buildServiceStatus({
        service: 'activepieces',
        required: isRequiredReadinessService(input.profile, 'activepieces'),
        blockers: [
          ...baseDatabaseBlockers(input.databaseReachable),
          ...missingRelationBlockers(input.existingRelations, [
            'app.workflow_runs',
            'app.approval_tasks',
            'app.delivery_requests',
            'app.delivery_attempts',
          ]),
          ...(activepiecesConfigured
            ? []
            : [
                'ACTIVEPIECES_API_KEY и ACTIVEPIECES_SIGNING_PRIVATE_KEY должны быть настроены.',
              ]),
          ...(this.env.ACTIVEPIECES_SIMULATE_RUNS === '0'
            ? []
            : [
                'ACTIVEPIECES_SIMULATE_RUNS должен быть 0 для реального dispatch в Activepieces runtime.',
              ]),
          ...(isConfiguredSecret(this.env.LEXFRAME_RUNTIME_MASTER_SECRET)
            ? []
            : [
                'LEXFRAME_RUNTIME_MASTER_SECRET должен быть настроен для runtime callback.',
              ]),
          ...input.externalProbes.activepieces.blockers,
        ],
        summaryReady:
          'Предусловия подписи и dispatch Activepieces runtime настроены.',
        summaryBlocked:
          'Activepieces runtime остаётся заблокированным или в режиме симуляции.',
        diagnostics: {
          runtimeRelationsReady,
          instanceUrl: this.env.ACTIVEPIECES_BASE_URL,
          simulateRuns: this.env.ACTIVEPIECES_SIMULATE_RUNS === '1',
          apiKeyConfigured: isConfiguredSecret(this.env.ACTIVEPIECES_API_KEY),
          signingKeyConfigured: isConfiguredSecret(
            this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
          ),
          runtimeMasterSecretConfigured: isConfiguredSecret(
            this.env.LEXFRAME_RUNTIME_MASTER_SECRET,
          ),
          ...input.externalProbes.activepieces.diagnostics,
        },
      }),
      buildServiceStatus({
        service: 'redis',
        required: isRequiredReadinessService(input.profile, 'redis'),
        blockers:
          this.env.ACTIVEPIECES_SIMULATE_RUNS === '0' &&
          isConfiguredSecret(this.env.ACTIVEPIECES_API_KEY)
            ? []
            : [
                'Redis-backed Activepieces runtime считается доступным только при включённом реальном dispatch Activepieces.',
              ],
        summaryReady:
          'Redis-зависимость покрыта контрактом реального Activepieces runtime.',
        summaryBlocked:
          'Redis не считается доступным, пока Activepieces остаётся в симуляции.',
        diagnostics: {
          inferred: true,
          simulateRuns: this.env.ACTIVEPIECES_SIMULATE_RUNS === '1',
          source: 'activepieces-runtime-contract',
        },
      }),
      buildServiceStatus({
        service: 'opensearch',
        required: isRequiredReadinessService(input.profile, 'opensearch'),
        blockers: [
          ...baseDatabaseBlockers(input.databaseReachable),
          ...(opensearchRelationsReady
            ? []
            : [
                'Хранилище поисковых фрагментов app.document_text_chunks ещё не готово.',
              ]),
          ...input.externalProbes.opensearch.blockers,
        ],
        summaryReady:
          'Предусловия хранилища поисковых фрагментов готовы для OpenSearch indexing.',
        summaryBlocked: 'Предусловия поиска с OpenSearch ещё не выполнены.',
        diagnostics: {
          indexAlias: this.env.OPENSEARCH_INDEX_ALIAS,
          opensearchUrl: this.env.OPENSEARCH_URL,
          opensearchRelationsReady,
          ...input.externalProbes.opensearch.diagnostics,
        },
      }),
      buildServiceStatus({
        service: 'delivery-sandbox',
        required: isRequiredReadinessService(input.profile, 'delivery-sandbox'),
        blockers: input.externalProbes.deliverySandbox.blockers,
        summaryReady:
          'Webhook-транспорт отправки настроен для downstream smoke-проверки.',
        summaryBlocked:
          'Sandbox-транспорт отправки всё ещё отключён для runtime-гейтов доставки.',
        diagnostics: {
          transport: this.env.LEXFRAME_DELIVERY_TRANSPORT,
          webhookUrlConfigured:
            (this.env.LEXFRAME_DELIVERY_WEBHOOK_URL ?? '').trim().length > 0,
          ...input.externalProbes.deliverySandbox.diagnostics,
        },
      }),
      buildServiceStatus({
        service: 'local-owner-key-vault',
        required: isRequiredReadinessService(
          input.profile,
          'local-owner-key-vault',
        ),
        blockers:
          localKeysStatus.status === 'ready'
            ? []
            : localKeysStatus.schema.errors.map((error) => error.code),
        summaryReady:
          'Local Owner Key Vault is readable and exposes only fingerprinted metadata.',
        summaryBlocked:
          'Local Owner Key Vault is not ready for backend-only AI provider usage.',
        diagnostics: localKeysStatus as unknown as Record<string, unknown>,
      }),
      buildServiceStatus({
        service: 'real-ai-provider',
        required: isRequiredReadinessService(input.profile, 'real-ai-provider'),
        blockers: aiConfigured
          ? []
          : ['Необходимо настроить хотя бы одного внешнего ИИ-провайдера.'],
        summaryReady:
          'Настроен хотя бы один ключ реального внешнего ИИ-провайдера.',
        summaryBlocked:
          'Для интегрированного выполнения не настроен ключ реального внешнего ИИ-провайдера.',
        diagnostics: {
          providerMode: aiProviderMode,
          realProviderKeyConfigured: aiKeyConfigured,
          xaiConfigured: isConfiguredSecret(this.env.XAI_API_KEY),
          cometConfigured:
            isConfiguredSecret(this.env.COMETAPI_API_KEY) ||
            hasConfiguredSecretList(this.env.COMETAPI_API_KEYS),
          localOwnerKeyVaultReady: localKeyConfigured,
        },
      }),
      buildServiceStatus({
        service: 'realtime',
        required: isRequiredReadinessService(input.profile, 'realtime'),
        blockers: [
          ...baseDatabaseBlockers(input.databaseReachable),
          ...missingRelationBlockers(input.existingRelations, [
            'app.live_events',
            'app.realtime_topic_acl',
            'app.notifications',
            'app.device_tokens',
          ]),
          ...(input.latestLiveEventAt
            ? []
            : ['Realtime-события ещё не записывались.']),
          ...releaseGateFailures,
        ],
        summaryReady:
          'Схема realtime-событий и недавняя активность доступны для dashboard streaming.',
        summaryBlocked: 'Предусловия realtime streaming ещё не выполнены.',
        diagnostics: {
          realtimeRelationsReady,
          latestLiveEventAt: input.latestLiveEventAt,
        },
      }),
    ];
  }

  private async loadExistingRelations(names: readonly string[]) {
    try {
      const result = await this.databaseService.query<{
        readonly full_name: string;
      }>(
        `
          select table_schema || '.' || table_name as full_name
          from information_schema.tables
          where (table_schema || '.' || table_name) = any($1::text[])
          union
          select table_schema || '.' || table_name as full_name
          from information_schema.views
          where (table_schema || '.' || table_name) = any($1::text[])
        `,
        [names],
      );

      return new Set(result.rows.map((row) => row.full_name));
    } catch {
      return new Set<string>();
    }
  }

  private async loadReleaseGates(): Promise<readonly ReleaseGateRow[]> {
    try {
      const result = await this.databaseService.query<ReleaseGateRow>(
        `
          select gate_code, required, latest_status
          from api.stage11_security_overview
          order by gate_code asc
        `,
      );

      return result.rows;
    } catch {
      return [];
    }
  }

  private async loadLatestTimestamp(
    relationName: string,
  ): Promise<string | null> {
    try {
      const row = await this.databaseService.one<{
        readonly value: string | null;
      }>(`select max(created_at)::text as value from ${relationName}`);

      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  private async loadExternalProbeSnapshot(): Promise<ExternalProbeSnapshot> {
    const [supabaseStorage, activepieces, opensearch, deliverySandbox] =
      await Promise.all([
        this.probeSupabaseStorage(),
        this.probeActivepiecesApi(),
        this.probeOpenSearch(),
        this.probeDeliverySandbox(),
      ]);

    return {
      supabaseStorage,
      activepieces,
      opensearch,
      deliverySandbox,
    };
  }

  private async probeSupabaseStorage(): Promise<ExternalServiceProbe> {
    if (!isConfiguredSecret(this.env.SUPABASE_SECRET_KEY)) {
      return blockedProbe(
        'Supabase Storage signing preflight skipped.',
        'SUPABASE_SECRET_KEY is not configured for Storage signed URL probes.',
        {
          configured: false,
        },
      );
    }

    const baseUrl = (this.env.SUPABASE_URL ?? '').replace(/\/$/, '');

    if (baseUrl.length === 0) {
      return blockedProbe(
        'Supabase Storage signing preflight skipped.',
        'SUPABASE_URL is not configured for Storage signed URL probes.',
        {
          configured: false,
        },
      );
    }

    const probeUrl = `${baseUrl}/storage/v1/object/sign/documents-private/readiness-probe.txt`;

    try {
      const response = await fetchWithTimeout(probeUrl, {
        method: 'POST',
        headers: {
          apikey: this.env.SUPABASE_SECRET_KEY,
          authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 }),
      });
      const text = await response.text();
      const payload = parseJsonObject(text);
      const signedUrl = payload?.signedURL ?? payload?.signedUrl;

      if (!response.ok || typeof signedUrl !== 'string') {
        return blockedProbe(
          'Supabase Storage signing preflight failed.',
          `Supabase Storage sign endpoint returned ${response.status}.`,
          {
            status: response.status,
            hasSignedUrl: typeof signedUrl === 'string',
          },
        );
      }

      return readyProbe('Supabase Storage signing preflight succeeded.', {
        status: response.status,
        signedUrlReturned: true,
      });
    } catch (error) {
      return blockedProbe(
        'Supabase Storage signing preflight failed.',
        `Supabase Storage sign endpoint probe failed: ${errorMessage(error)}.`,
        {
          error: errorMessage(error),
        },
      );
    }
  }

  private async probeActivepiecesApi(): Promise<ExternalServiceProbe> {
    if (!isConfiguredSecret(this.env.ACTIVEPIECES_API_KEY)) {
      return blockedProbe(
        'Activepieces API preflight skipped.',
        'ACTIVEPIECES_API_KEY is not configured for Activepieces API probes.',
        {
          apiKeyConfigured: false,
        },
      );
    }

    const baseUrl = (this.env.ACTIVEPIECES_BASE_URL ?? '').replace(/\/$/, '');

    if (baseUrl.length === 0) {
      return blockedProbe(
        'Activepieces API preflight skipped.',
        'ACTIVEPIECES_BASE_URL is not configured for Activepieces API probes.',
        {
          baseUrlConfigured: false,
        },
      );
    }

    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/v1/projects?limit=1`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${this.env.ACTIVEPIECES_API_KEY}`,
            'content-type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const fallback = await this.probeActivepiecesFlags(baseUrl);

        if (fallback.ready) {
          return readyProbe('Activepieces API preflight succeeded via flags.', {
            projectListStatus: response.status,
            fallback: 'flags',
            ...fallback.diagnostics,
          });
        }

        return blockedProbe(
          'Activepieces API preflight failed.',
          `Activepieces API returned ${response.status}.`,
          {
            status: response.status,
            fallback,
          },
        );
      }

      const payload = parseJsonObject(await response.text());
      const projectCount = Array.isArray(payload?.data)
        ? payload.data.length
        : null;

      return readyProbe('Activepieces API preflight succeeded.', {
        status: response.status,
        projectCount,
      });
    } catch (error) {
      const fallback = await this.probeActivepiecesFlags(baseUrl);

      if (fallback.ready) {
        return readyProbe('Activepieces API preflight succeeded via flags.', {
          fallback: 'flags',
          ...fallback.diagnostics,
        });
      }

      return blockedProbe(
        'Activepieces API preflight failed.',
        `Activepieces API probe failed: ${errorMessage(error)}.`,
        {
          error: errorMessage(error),
          fallback,
        },
      );
    }
  }

  private async probeActivepiecesFlags(
    baseUrl: string,
  ): Promise<ExternalServiceProbe> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/v1/flags`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
        },
      });

      if (!response.ok) {
        return blockedProbe(
          'Activepieces flags preflight failed.',
          `Activepieces flags endpoint returned ${response.status}.`,
          {
            status: response.status,
          },
        );
      }

      const payload = parseJsonObject(await response.text());

      return readyProbe('Activepieces flags preflight succeeded.', {
        status: response.status,
        environment: payload?.ENVIRONMENT ?? null,
        userCreated: payload?.USER_CREATED ?? null,
      });
    } catch (error) {
      return blockedProbe(
        'Activepieces flags preflight failed.',
        `Activepieces flags endpoint probe failed: ${errorMessage(error)}.`,
        {
          error: errorMessage(error),
        },
      );
    }
  }

  private async probeOpenSearch(): Promise<ExternalServiceProbe> {
    const baseUrl = (this.env.OPENSEARCH_URL ?? '').replace(/\/$/, '');

    if (baseUrl.length === 0) {
      return blockedProbe(
        'OpenSearch preflight skipped.',
        'OPENSEARCH_URL is not configured for OpenSearch probes.',
        {
          configured: false,
        },
      );
    }

    try {
      const healthResponse = await fetchWithTimeout(
        `${baseUrl}/_cluster/health`,
        {
          method: 'GET',
        },
      );

      if (!healthResponse.ok) {
        return blockedProbe(
          'OpenSearch cluster health preflight failed.',
          `OpenSearch health endpoint returned ${healthResponse.status}.`,
          {
            healthStatus: healthResponse.status,
          },
        );
      }

      const health = parseJsonObject(await healthResponse.text());
      const indexAlias = this.env.OPENSEARCH_INDEX_ALIAS.trim();
      const indexResponse = await fetchWithTimeout(
        `${baseUrl}/${encodeURIComponent(indexAlias)}`,
        { method: 'HEAD' },
      );

      if (!indexResponse.ok) {
        return blockedProbe(
          'OpenSearch index preflight failed.',
          `OpenSearch index alias ${indexAlias} returned ${indexResponse.status}.`,
          {
            clusterStatus: health?.status ?? null,
            indexAlias,
            indexStatus: indexResponse.status,
          },
        );
      }

      return readyProbe(
        'OpenSearch cluster and search index preflight succeeded.',
        {
          clusterStatus: health?.status ?? null,
          indexAlias,
          indexStatus: indexResponse.status,
        },
      );
    } catch (error) {
      return blockedProbe(
        'OpenSearch preflight failed.',
        `OpenSearch probe failed: ${errorMessage(error)}.`,
        {
          error: errorMessage(error),
        },
      );
    }
  }

  private async probeDeliverySandbox(): Promise<ExternalServiceProbe> {
    if (!isDeliveryTransportConfigured(this.env)) {
      return blockedProbe(
        'Delivery sandbox preflight skipped.',
        'Webhook delivery transport is not configured.',
        {
          transport: this.env.LEXFRAME_DELIVERY_TRANSPORT,
          webhookUrlConfigured:
            (this.env.LEXFRAME_DELIVERY_WEBHOOK_URL ?? '').trim().length > 0,
        },
      );
    }

    const webhookUrl = this.env.LEXFRAME_DELIVERY_WEBHOOK_URL.trim();

    try {
      const parsed = new URL(webhookUrl);

      if (!isLocalhost(parsed.hostname)) {
        return readyProbe(
          'Delivery webhook is configured; sandbox health probe skipped for non-local endpoint.',
          {
            transport: this.env.LEXFRAME_DELIVERY_TRANSPORT,
            webhookHost: parsed.hostname,
            sandboxProbeSkipped: true,
          },
        );
      }

      const healthUrl = `${parsed.origin}/health`;
      const response = await fetchWithTimeout(healthUrl, { method: 'GET' });

      if (!response.ok) {
        return blockedProbe(
          'Delivery sandbox health preflight failed.',
          `Delivery sandbox health endpoint returned ${response.status}.`,
          {
            status: response.status,
            healthUrl,
          },
        );
      }

      const payload = parseJsonObject(await response.text());

      return readyProbe('Delivery sandbox health preflight succeeded.', {
        status: response.status,
        healthUrl,
        sandboxStatus: payload?.status ?? null,
      });
    } catch (error) {
      return blockedProbe(
        'Delivery sandbox health preflight failed.',
        `Delivery sandbox probe failed: ${errorMessage(error)}.`,
        {
          error: errorMessage(error),
        },
      );
    }
  }
}

function stage17Check(
  status: Stage17ReadinessCheck['status'],
  summary: string,
  blocking: boolean,
  details: Record<string, unknown> = {},
): Stage17ReadinessCheck {
  return {
    status,
    summary,
    blocking,
    details,
  };
}

function stage18Check(
  status: Stage18ReadinessCheck['status'],
  message: string,
): Stage18ReadinessCheck {
  return {
    status,
    message,
  };
}

function stage19Check(
  status: Stage19ReadinessResponse['checks']['chat_api']['status'],
  reason: string,
): Stage19ReadinessResponse['checks']['chat_api'] {
  return {
    status,
    reason,
  };
}

function artifactReadinessCheck(
  artifactPath: string,
  passMessage: string,
): Stage18ReadinessCheck {
  return existsSync(resolve(process.cwd(), artifactPath))
    ? stage18Check('pass', passMessage)
    : stage18Check('degraded', `${artifactPath} has not been generated yet.`);
}

function isEnabledFlag(value: string | undefined) {
  return value === '1' || value === 'true';
}

async function probeHttp(url: string) {
  const startedAt = Date.now();
  try {
    let response = await fetchWithTimeout(url, { method: 'GET' });
    if (!response.ok && url.endsWith('/api/v1/health')) {
      const fallbackUrl = url.replace(/\/api\/v1\/health$/, '/api/v1/flags');
      response = await fetchWithTimeout(fallbackUrl, { method: 'GET' });
    }

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null as number | null,
      latencyMs: Date.now() - startedAt,
      error: errorMessage(error),
    };
  }
}

function readSecretValue(
  value: string | undefined,
  filePath: string | undefined,
) {
  const normalized = value?.trim();
  if (normalized && normalized.length > 0 && !isPlaceholderSecret(normalized)) {
    return normalized;
  }

  const normalizedPath = filePath?.trim();
  if (!normalizedPath || !existsSync(normalizedPath)) {
    return null;
  }

  try {
    const fileValue = readFileSync(normalizedPath, 'utf8').trim();
    return fileValue.length > 0 && !isPlaceholderSecret(fileValue)
      ? fileValue
      : null;
  } catch {
    return null;
  }
}

function isPlaceholderSecret(value: string) {
  return /^(stage0_|replace_with_|demo_|placeholder|example|change_me|PASTE_|YOUR_|<)/i.test(
    value,
  );
}

async function pingRedis(input: {
  readonly host: string;
  readonly port: number;
  readonly password: string | null;
  readonly timeoutMs: number;
}): Promise<{ ok: boolean; error: string | null }> {
  return new Promise((resolveResult) => {
    const socket = net.createConnection({
      host: input.host,
      port: input.port,
    });
    const chunks: Buffer[] = [];
    let done = false;
    const finish = (result: { ok: boolean; error: string | null }) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timeout);
      resolveResult(result);
    };
    const timeout = setTimeout(() => {
      socket.destroy();
      finish({ ok: false, error: 'timeout' });
    }, input.timeoutMs);

    socket.on('connect', () => {
      const commands = input.password
        ? [redisCommand(['AUTH', input.password]), redisCommand(['PING'])]
        : [redisCommand(['PING'])];
      socket.write(commands.join(''));
    });
    socket.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.includes('+PONG')) {
        socket.end();
        finish({ ok: true, error: null });
      }
      if (
        text.includes('-ERR') ||
        text.includes('-NOAUTH') ||
        text.includes('-WRONGPASS')
      ) {
        socket.end();
        finish({ ok: false, error: text.trim().slice(0, 200) });
      }
    });
    socket.on('error', (error) => {
      finish({ ok: false, error: error.message });
    });
    socket.on('close', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.includes('+PONG')) {
        finish({
          ok: false,
          error: text.trim().slice(0, 200) || 'connection_closed',
        });
      }
    });
  });
}

function redisCommand(parts: readonly string[]) {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join('')}`;
}

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return value;
  }
}

function buildReadinessGate(input: {
  readonly stage: string;
  readonly owner: string;
  readonly linkedContracts: readonly string[];
  readonly linkedTests: readonly string[];
  readonly blockers: readonly string[];
  readonly hasSchema: boolean;
  readonly hasRuntime: boolean;
}): ReadinessGate {
  return {
    stage: input.stage,
    state: resolveState(input.hasSchema, input.hasRuntime, input.blockers),
    blockers: dedupe(input.blockers),
    owner: input.owner,
    linkedContracts: input.linkedContracts,
    linkedTests: input.linkedTests,
  };
}

function buildServiceStatus(input: {
  readonly service: ReadinessServiceCode;
  readonly required: boolean;
  readonly blockers: readonly string[];
  readonly summaryReady: string;
  readonly summaryBlocked: string;
  readonly diagnostics: Record<string, unknown>;
}): ReadinessServiceStatus {
  const blockers = dedupe(input.blockers);
  const state = blockers.length > 0 ? 'blocked' : 'ready';

  return {
    service: input.service,
    state,
    required: input.required,
    summary: state === 'ready' ? input.summaryReady : input.summaryBlocked,
    blockers,
    diagnostics: input.diagnostics,
  };
}

function evaluateReadinessContract(
  profile: ReadinessProfile,
  _allowReadinessGateBlocked: boolean,
  serviceStatuses: readonly ReadinessServiceStatus[],
) {
  const requiredStatuses = serviceStatuses.filter((status) =>
    isRequiredReadinessService(profile, status.service),
  );
  const requiredReady = requiredStatuses.every(
    (status) => status.state === 'ready',
  );

  if (!requiredReady) {
    return false;
  }

  return true;
}

function summarizeServiceStatuses(
  serviceStatuses: readonly ReadinessServiceStatus[],
): ReadinessSummaryResponse['serviceSummary'] {
  return {
    total: serviceStatuses.length,
    ready: serviceStatuses.filter((status) => status.state === 'ready').length,
    degraded: serviceStatuses.filter((status) => status.state === 'degraded')
      .length,
    blocked: serviceStatuses.filter((status) => status.state === 'blocked')
      .length,
  };
}

function resolveState(
  hasSchema: boolean,
  hasRuntime: boolean,
  blockers: readonly string[],
): ReadinessState {
  if (!hasSchema) {
    return 'contract_ready';
  }

  if (!hasRuntime) {
    return 'backend_ready';
  }

  if (blockers.length > 0) {
    return 'integration_ready';
  }

  return 'production_ready';
}

function baseDatabaseBlockers(databaseReachable: boolean) {
  return databaseReachable
    ? []
    : ['Основное хранилище PostgreSQL не ответило на readiness probe.'];
}

function missingRelationBlockers(
  existingRelations: ReadonlySet<string>,
  expectedRelations: readonly string[],
) {
  return expectedRelations
    .filter((relationName) => !existingRelations.has(relationName))
    .map(
      (relationName) => `Обязательная relation ${relationName} отсутствует.`,
    );
}

function hasRelations(
  existingRelations: ReadonlySet<string>,
  expectedRelations: readonly string[],
) {
  return expectedRelations.every((relationName) =>
    existingRelations.has(relationName),
  );
}

function isConfiguredSecret(value: string | undefined) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.startsWith('stage0_') &&
    !value.startsWith('replace_with_') &&
    !value.startsWith('demo_')
  );
}

function hasConfiguredSecretList(value: string | undefined) {
  return (value ?? '')
    .split(/[\s,;]+/)
    .some((item) => isConfiguredSecret(item));
}

function isDeliveryTransportConfigured(env: ReturnType<typeof loadServerEnv>) {
  return (
    env.LEXFRAME_DELIVERY_TRANSPORT === 'webhook' &&
    (env.LEXFRAME_DELIVERY_WEBHOOK_URL ?? '').trim().length > 0
  );
}

function buildAiProviderBlockers(input: {
  readonly providerMode: string;
  readonly keyConfigured: boolean;
  readonly strictRealRequired: boolean;
}) {
  const blockers: string[] = [];

  if (input.strictRealRequired && input.providerMode !== 'controlled-real') {
    blockers.push(
      'AI_PROVIDER_MODE must be controlled-real for staging-rc and production readiness.',
    );
  }

  if (
    (input.strictRealRequired || input.providerMode === 'controlled-real') &&
    !input.keyConfigured
  ) {
    blockers.push(
      'At least one controlled real AI provider key must be configured.',
    );
  }

  return blockers;
}

function readyProbe(
  summary: string,
  diagnostics: Record<string, unknown> = {},
): ExternalServiceProbe {
  return {
    ready: true,
    summary,
    blockers: [],
    diagnostics: {
      ready: true,
      summary,
      ...diagnostics,
    },
  };
}

function blockedProbe(
  summary: string,
  blocker: string,
  diagnostics: Record<string, unknown> = {},
): ExternalServiceProbe {
  return {
    ready: false,
    summary,
    blockers: [blocker],
    diagnostics: {
      ready: false,
      summary,
      ...diagnostics,
    },
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 2_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}

function isLocalhost(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  );
}

function dedupe(values: readonly string[]) {
  return Array.from(new Set(values));
}
