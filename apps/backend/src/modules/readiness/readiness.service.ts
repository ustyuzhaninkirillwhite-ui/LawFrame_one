import type {
  ReadinessDetailsResponse,
  ReadinessGate,
  ReadinessProfile,
  ReadinessServiceCode,
  ReadinessServiceStatus,
  ReadinessState,
  ReadinessSummaryResponse,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { WorkflowsService } from '../workflows/workflows.service';
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

    const aiProviderMode = this.env.AI_PROVIDER_MODE;
    const aiKeyConfigured =
      isConfiguredSecret(this.env.XAI_API_KEY) ||
      isConfiguredSecret(this.env.COMETAPI_API_KEY);
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
    const aiKeyConfigured =
      isConfiguredSecret(this.env.XAI_API_KEY) ||
      isConfiguredSecret(this.env.COMETAPI_API_KEY);
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
          cometConfigured: isConfiguredSecret(this.env.COMETAPI_API_KEY),
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
