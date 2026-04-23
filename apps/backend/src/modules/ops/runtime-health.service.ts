import type {
  RuntimeDependencyStatus,
  RuntimeHealthSummary,
  SystemStatusSummary,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReadinessService } from '../readiness/readiness.service';

@Injectable()
export class RuntimeHealthService {
  private readonly env = loadServerEnv();
  private readonly startedAt = Date.now();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly readinessService: ReadinessService,
  ) {}

  getLiveSummary(): Promise<RuntimeHealthSummary> {
    return Promise.resolve({
      status: 'ok',
      service: 'backend',
      environment: this.env.LEXFRAME_DEPLOY_ENV,
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: [],
    });
  }

  async getDependencies(): Promise<readonly RuntimeDependencyStatus[]> {
    const checkedAt = new Date().toISOString();
    const [storageHealthy, activepieces, search, worker, readinessSnapshot] =
      await Promise.all([
        this.databaseService.ping(),
        checkHttpDependency(
          'activepieces',
          this.env.ACTIVEPIECES_BASE_URL,
          this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
        ),
        checkHttpDependency(
          'search',
          this.env.OPENSEARCH_URL,
          this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
        ),
        checkHttpDependency(
          'realtime',
          this.env.LEXFRAME_MINING_WORKER_HEALTH_URL,
          this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
        ),
        this.readinessService.getReadinessSnapshot(),
      ]);

    const aiConfigured =
      isConfiguredSecret(this.env.XAI_API_KEY) ||
      isConfiguredSecret(this.env.COMETAPI_API_KEY);
    const readiness = readinessSnapshot.gates;
    const readinessBlocked = readiness.some((gate) => gate.blockers.length > 0);

    return [
      {
        code: 'storage',
        status: storageHealthy ? 'healthy' : 'blocked',
        summary: storageHealthy
          ? 'Основное хранилище PostgreSQL ответило на проверочный запрос.'
          : 'Основное хранилище PostgreSQL не ответило на проверочный запрос.',
        checkedAt,
      },
      activepieces,
      {
        code: 'ai',
        status: aiConfigured ? 'healthy' : 'blocked',
        summary: aiConfigured
          ? 'Для runtime-маршрутизации настроен хотя бы один внешний ИИ-провайдер.'
          : 'Внешние ИИ-провайдеры не настроены, поэтому защищённые runtime-маршруты остаются закрыты.',
        checkedAt,
      },
      search,
      {
        code: 'realtime',
        status:
          worker.status === 'blocked'
            ? 'blocked'
            : readinessBlocked
              ? 'degraded'
              : worker.status,
        summary:
          worker.status === 'blocked'
            ? worker.summary
            : readinessBlocked
              ? 'Realtime и фоновая отправка зависят от upstream-гейтов готовности, которые ещё не полностью зелёные.'
              : worker.summary,
        checkedAt,
      },
    ];
  }

  async getReadySummary(): Promise<RuntimeHealthSummary> {
    const dependencies = await this.getDependencies();
    const status = summarizeHealth(dependencies);

    return {
      status,
      service: 'backend',
      environment: this.env.LEXFRAME_DEPLOY_ENV,
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.max(
        0,
        Math.floor((Date.now() - this.startedAt) / 1000),
      ),
      dependencies,
    };
  }

  async getSystemStatus(): Promise<SystemStatusSummary> {
    const dependencies = await this.getDependencies();
    const checkedAt = new Date().toISOString();
    const components = dependencies.map((dependency) => ({
      code: dependency.code,
      label: dependency.code,
      status: dependency.status,
      summary: dependency.summary,
      checkedAt,
    }));

    return {
      overall: mapRuntimeStatusToSystemStatus(summarizeHealth(dependencies)),
      summary:
        'Состояние runtime объединяет хранилище, ИИ-маршрутизацию, Activepieces, поиск и realtime-зависимости для решений о degraded mode.',
      checkedAt,
      incidentsOpen: 0,
      components,
    };
  }

  async renderMetrics(): Promise<string> {
    const dependencies = await this.getDependencies();
    const readiness = (await this.readinessService.getReadinessSnapshot())
      .gates;
    const readinessLines = readiness.map((gate) => {
      const value =
        gate.blockers.length > 0
          ? 0
          : gate.state === 'production_ready' ||
              gate.state === 'integration_ready'
            ? 2
            : 1;

      return `lexframe_readiness_gate_status{stage="${gate.stage}",state="${gate.state}"} ${value}`;
    });

    return [
      '# HELP lexframe_runtime_uptime_seconds Backend process uptime in seconds.',
      '# TYPE lexframe_runtime_uptime_seconds gauge',
      `lexframe_runtime_uptime_seconds{service="backend",environment="${this.env.LEXFRAME_DEPLOY_ENV}"} ${Math.floor(process.uptime())}`,
      '# HELP lexframe_dependency_status Runtime dependency health where healthy=2, degraded=1, blocked=0.',
      '# TYPE lexframe_dependency_status gauge',
      ...dependencies.map(
        (dependency) =>
          `lexframe_dependency_status{dependency="${dependency.code}",environment="${this.env.LEXFRAME_DEPLOY_ENV}"} ${statusToMetricValue(dependency.status)}`,
      ),
      '# HELP lexframe_readiness_gate_status Readiness gate state where healthy=2, degraded=1, blocked=0.',
      '# TYPE lexframe_readiness_gate_status gauge',
      ...readinessLines,
      '',
    ].join('\n');
  }
}

function summarizeHealth(
  dependencies: readonly RuntimeDependencyStatus[],
): RuntimeHealthSummary['status'] {
  if (dependencies.some((dependency) => dependency.status === 'blocked')) {
    return 'blocked';
  }

  if (dependencies.some((dependency) => dependency.status === 'degraded')) {
    return 'degraded';
  }

  return 'ok';
}

function mapRuntimeStatusToSystemStatus(
  status: RuntimeHealthSummary['status'],
): SystemStatusSummary['overall'] {
  if (status === 'ok') {
    return 'healthy';
  }

  return status;
}

function statusToMetricValue(status: RuntimeDependencyStatus['status']) {
  switch (status) {
    case 'healthy':
      return 2;
    case 'degraded':
      return 1;
    default:
      return 0;
  }
}

function isConfiguredSecret(value: string) {
  return !value.startsWith('stage0_') && !value.startsWith('replace_with_');
}

async function checkHttpDependency(
  code: RuntimeDependencyStatus['code'],
  url: string,
  timeoutMs: number,
): Promise<RuntimeDependencyStatus> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const reachable = response.ok || response.status < 500;

    return {
      code,
      status: reachable ? 'healthy' : 'degraded',
      summary: reachable
        ? `${url} ответил HTTP ${response.status}.`
        : `${url} ответил HTTP ${response.status}.`,
      checkedAt,
    };
  } catch (error) {
    return {
      code,
      status: 'blocked',
      summary:
        error instanceof Error
          ? `${url}: проверка не прошла: ${error.message}`
          : `${url}: проверка не прошла.`,
      checkedAt,
    };
  }
}
