import type {
  RuntimeDependencyStatus,
  RuntimeHealthSummary,
  SystemStatusSummary,
} from '@lexframe/contracts';
import type { ServerEnv } from '@lexframe/config';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReadinessService } from '../readiness/readiness.service';

type MiningWorkerReadyPayload = {
  readonly status?: unknown;
  readonly summary?: unknown;
  readonly service?: unknown;
  readonly lastError?: unknown;
  readonly error?: unknown;
};

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
    const [storageHealthy, activepieces, search, worker] = await Promise.all([
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
      checkMiningWorkerDependency(
        this.env.LEXFRAME_MINING_WORKER_HEALTH_URL,
        this.env.LEXFRAME_HEALTHCHECK_TIMEOUT_MS,
      ),
    ]);

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
      resolveAiDependency(this.env, checkedAt),
      search,
      worker,
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
    const overall = mapRuntimeStatusToSystemStatus(
      summarizeHealth(dependencies),
    );

    return {
      overall,
      summary:
        overall === 'healthy'
          ? 'Все runtime-зависимости доступны; автоматизации работают в полном режиме.'
          : 'Некоторые runtime-зависимости недоступны; функции автоматизаций временно ограничены.',
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

function resolveAiDependency(
  env: ServerEnv,
  checkedAt: string,
): RuntimeDependencyStatus {
  const hasRealAiKey =
    isConfiguredSecret(env.XAI_API_KEY) ||
    isConfiguredSecret(env.COMETAPI_API_KEY) ||
    hasConfiguredSecretList(env.COMETAPI_API_KEYS);

  if (env.AI_PROVIDER_MODE !== 'controlled-real') {
    return {
      code: 'ai',
      status: 'blocked',
      summary:
        'Full-services режим требует AI_PROVIDER_MODE=controlled-real; сейчас включён mock-провайдер.',
      checkedAt,
    };
  }

  if (!hasRealAiKey) {
    return {
      code: 'ai',
      status: 'blocked',
      summary:
        'Full-services режим требует XAI_API_KEY, COMETAPI_API_KEY или COMETAPI_API_KEYS.',
      checkedAt,
    };
  }

  return {
    code: 'ai',
    status: 'healthy',
    summary: 'Внешний ИИ-провайдер подключён для runtime-маршрутизации.',
    checkedAt,
  };
}

function isConfiguredSecret(value: string | undefined) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.startsWith('stage0_') &&
    !value.startsWith('replace_with_')
  );
}

function hasConfiguredSecretList(value: string) {
  return value.split(/[\s,;]+/).some((item) => isConfiguredSecret(item.trim()));
}

async function checkMiningWorkerDependency(
  url: string,
  timeoutMs: number,
): Promise<RuntimeDependencyStatus> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await readMiningWorkerPayload(response);
    const status = mapMiningWorkerStatus(payload?.status);

    return {
      code: 'realtime',
      status:
        response.ok || response.status < 500
          ? status
          : status === 'blocked'
            ? 'blocked'
            : 'degraded',
      summary: describeMiningWorkerStatus(url, response.status, payload),
      checkedAt,
    };
  } catch (error) {
    return {
      code: 'realtime',
      status: 'blocked',
      summary:
        error instanceof Error
          ? `${url}: mining-worker /health/ready недоступен: ${error.message}`
          : `${url}: mining-worker /health/ready недоступен.`,
      checkedAt,
    };
  }
}

async function readMiningWorkerPayload(
  response: Response,
): Promise<MiningWorkerReadyPayload | null> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mapMiningWorkerStatus(
  status: unknown,
): RuntimeDependencyStatus['status'] {
  if (status === 'ok') {
    return 'healthy';
  }

  if (status === 'degraded') {
    return 'degraded';
  }

  return 'blocked';
}

function describeMiningWorkerStatus(
  url: string,
  httpStatus: number,
  payload: MiningWorkerReadyPayload | null,
) {
  const rawStatus = typeof payload?.status === 'string' ? payload.status : null;
  const detail =
    toSummaryText(payload?.summary) ??
    toSummaryText(payload?.lastError) ??
    toSummaryText(payload?.error);

  if (rawStatus === 'ok') {
    return `${url} ответил HTTP ${httpStatus}; mining-worker готов.`;
  }

  if (rawStatus === 'degraded') {
    return detail
      ? `${url} ответил HTTP ${httpStatus}; mining-worker ограничен: ${detail}`
      : `${url} ответил HTTP ${httpStatus}; mining-worker ограничен.`;
  }

  if (rawStatus === 'blocked') {
    return detail
      ? `${url} ответил HTTP ${httpStatus}; mining-worker заблокирован: ${detail}`
      : `${url} ответил HTTP ${httpStatus}; mining-worker заблокирован.`;
  }

  return `${url} ответил HTTP ${httpStatus}, но не вернул ожидаемый status=ok/degraded/blocked.`;
}

function toSummaryText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is MiningWorkerReadyPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
