import type {
  ActivepiecesCanvasReadinessWireResponse,
  ActivepiecesCanvasOpenCheckWire,
  AutomationCanvasReadinessCode,
} from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type {
  ActivepiecesFlowBindingForSession,
  ActivepiecesProjectBindingForSession,
  ActivepiecesUserBindingForSession,
} from './activepieces-session.types';

type ReadinessCheckStatus = 'pass' | 'warn' | 'fail' | 'repaired';

type WebSocketProbe = {
  addEventListener(
    event: 'open' | 'error' | 'close',
    listener: (event: unknown) => void,
    options?: { once?: boolean },
  ): void;
  close(): void;
};

type WebSocketProbeConstructor = new (url: string) => WebSocketProbe;

interface ActivepiecesProjectRow {
  readonly id: string;
  readonly externalId: string | null;
  readonly platformId: string | null;
}

interface ActivepiecesUserRow {
  readonly id: string;
  readonly externalId: string | null;
  readonly platformId: string | null;
}

interface ActivepiecesMembershipRow {
  readonly id: string;
}

interface ActivepiecesFlowRow {
  readonly id: string;
  readonly projectId: string;
  readonly publishedVersionId: string | null;
  readonly status: string | null;
}

interface ActivepiecesFlowVersionRow {
  readonly id: string;
  readonly flowId: string;
  readonly valid: boolean | null;
  readonly state: string | null;
}

interface ReadinessCheck {
  readonly name: string;
  readonly status: ReadinessCheckStatus;
  readonly code?: AutomationCanvasReadinessCode | null;
  readonly message?: string | null;
}

@Injectable()
export class ActivepiecesCanvasReadinessService implements OnModuleDestroy {
  private readonly env = loadServerEnv();
  private apPool: Pool | null = null;

  async validate(input: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly automationId: string;
    readonly projectBinding: ActivepiecesProjectBindingForSession;
    readonly userBinding: ActivepiecesUserBindingForSession;
    readonly flowBinding: ActivepiecesFlowBindingForSession;
    readonly repairAttempted: boolean;
    readonly canonicalReplacementRoute?: string | null;
  }): Promise<ActivepiecesCanvasReadinessWireResponse> {
    const checkedAt = new Date();
    const checks: ReadinessCheck[] = [];
    const runtimeVersion = normalizeOptionalVersion(
      process.env.ACTIVEPIECES_RUNTIME_VERSION ??
        process.env.ACTIVEPIECES_IMAGE_TAG ??
        null,
    );
    const sdkVersion = normalizeOptionalVersion(
      process.env.ACTIVEPIECES_EMBED_SDK_VERSION ??
        extractSdkVersion(process.env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL),
    );

    checks.push(
      buildVersionCheck({
        runtimeVersion,
        sdkVersion,
      }),
    );

    const pool = this.getActivepiecesPool();
    const client = await pool.connect();
    try {
      const project = await client
        .query<ActivepiecesProjectRow>(
          `
            select id, "externalId", "platformId"
            from project
            where id = $1
               or "externalId" = $2
            order by case when id = $1 then 0 else 1 end, created asc
            limit 1
          `,
          [
            input.projectBinding.activepiecesProjectId,
            input.projectBinding.externalProjectId,
          ],
        )
        .then((result) => result.rows[0] ?? null);

      checks.push(
        project
          ? pass('ap.project', `ActivePieces project ${project.id} exists.`)
          : fail(
              'ap.project',
              'AP_PROJECT_MISSING',
              'ActivePieces project binding points to a missing project.',
            ),
      );

      const user = await client
        .query<ActivepiecesUserRow>(
          `
            select id, "externalId", "platformId"
            from "user"
            where id = $1
               or "externalId" = $2
            order by case when id = $1 then 0 else 1 end, created asc
            limit 1
          `,
          [
            input.userBinding.activepiecesUserId,
            input.userBinding.externalUserId,
          ],
        )
        .then((result) => result.rows[0] ?? null);

      checks.push(
        user
          ? pass('ap.user', `ActivePieces user ${user.id} exists.`)
          : fail(
              'ap.user',
              'AP_USER_MISSING',
              'ActivePieces user binding points to a missing user.',
            ),
      );

      const platformId =
        project?.platformId ??
        user?.platformId ??
        STAGE17_ACTIVEPIECES_PLATFORM_ID;
      const membership =
        project && user
          ? await client
              .query<ActivepiecesMembershipRow>(
                `
                  select id
                  from project_member
                  where "projectId" = $1
                    and "userId" = $2
                    and "platformId" = $3
                  limit 1
                `,
                [project.id, user.id, platformId],
              )
              .then((result) => result.rows[0] ?? null)
          : null;

      checks.push(
        membership
          ? pass(
              'ap.project_member',
              `ActivePieces membership ${membership.id} exists.`,
            )
          : fail(
              'ap.project_member',
              'AP_PROJECT_MEMBERSHIP_MISSING',
              'ActivePieces user is not a member of the target project.',
            ),
      );

      const flow = await client
        .query<ActivepiecesFlowRow>(
          `
            select id, "projectId", "publishedVersionId", status
            from flow
            where id = $1
            limit 1
          `,
          [input.flowBinding.activepiecesFlowId],
        )
        .then((result) => result.rows[0] ?? null);

      if (!flow) {
        checks.push(
          fail(
            'ap.flow',
            'AP_FLOW_MISSING',
            'ActivePieces flow binding points to a missing flow.',
          ),
        );
      } else if (project && flow.projectId !== project.id) {
        checks.push(
          fail(
            'ap.flow',
            'AP_FLOW_PROJECT_MISMATCH',
            'ActivePieces flow belongs to another project.',
          ),
        );
      } else {
        checks.push(pass('ap.flow', `ActivePieces flow ${flow.id} exists.`));
      }

      const version = flow
        ? await client
            .query<ActivepiecesFlowVersionRow>(
              `
                select id, "flowId", valid, state
                from flow_version
                where ($1::text is not null and id = $1)
                   or "flowId" = $2
                order by case when id = $1 then 0 else 1 end, updated desc nulls last
                limit 1
              `,
              [input.flowBinding.activepiecesFlowVersionId, flow.id],
            )
            .then((result) => result.rows[0] ?? null)
        : null;

      checks.push(
        version
          ? pass(
              'ap.flow_version',
              `ActivePieces flow version ${version.id} exists.`,
            )
          : fail(
              'ap.flow_version',
              'AP_FLOW_MISSING',
              'ActivePieces flow has no readable version.',
            ),
      );

      const websocketCheck = await this.checkWebsocketReadiness();
      if (websocketCheck) {
        checks.push(websocketCheck);
      }

      const firstFailure = checks.find((check) => check.status === 'fail');
      const status = firstFailure
        ? firstFailure.code === 'ACTIVEPIECES_UNAVAILABLE' ||
          firstFailure.code === 'AP_WEBSOCKET_UNAVAILABLE'
          ? 'unavailable'
          : 'blocked'
        : input.repairAttempted
          ? 'repaired'
          : 'ready';
      const reasonCode = firstFailure?.code ?? 'READY';
      const readinessVersion = buildReadinessVersion({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        automationId: input.automationId,
        activepiecesProjectId: project?.id ?? null,
        activepiecesUserId: user?.id ?? null,
        activepiecesFlowId: flow?.id ?? null,
        activepiecesFlowVersionId: version?.id ?? null,
        runtimeVersion,
        sdkVersion,
        checks,
      });

      return {
        status,
        reason_code: reasonCode,
        readiness_code: reasonCode,
        activepieces_project_id:
          project?.id ?? input.flowBinding.activepiecesProjectId ?? null,
        activepieces_flow_id:
          flow?.id ?? input.flowBinding.activepiecesFlowId ?? null,
        activepieces_flow_version_id:
          version?.id ?? input.flowBinding.activepiecesFlowVersionId ?? null,
        readiness_version: readinessVersion,
        activepieces_version: runtimeVersion,
        embed_sdk_version: sdkVersion,
        expected_route: buildActivepiecesInitialRoute(
          flow?.id ?? input.flowBinding.activepiecesFlowId ?? null,
        ),
        refresh_policy: ACTIVEPIECES_CANVAS_REFRESH_POLICY,
        repair_attempted: input.repairAttempted,
        checked_at: checkedAt.toISOString(),
        checks,
        canonical_replacement_route: input.canonicalReplacementRoute ?? null,
        message:
          reasonCode === 'READY' ? null : messageForReadinessCode(reasonCode),
      };
    } finally {
      client.release();
    }
  }

  toOpenCheck(
    readiness: ActivepiecesCanvasReadinessWireResponse,
  ): ActivepiecesCanvasOpenCheckWire {
    return {
      status: readiness.status,
      reason_code: readiness.reason_code,
      activepieces_project_id: readiness.activepieces_project_id,
      activepieces_flow_id: readiness.activepieces_flow_id,
      activepieces_flow_version_id: readiness.activepieces_flow_version_id,
      readiness_version: readiness.readiness_version,
      activepieces_version: readiness.activepieces_version,
      embed_sdk_version: readiness.embed_sdk_version,
      expected_route: readiness.expected_route,
      refresh_policy: readiness.refresh_policy,
      repair_attempted: readiness.repair_attempted,
      checked_at: readiness.checked_at,
      checks: readiness.checks,
      canonical_replacement_route: readiness.canonical_replacement_route,
      message: readiness.message,
    };
  }

  async onModuleDestroy() {
    await this.apPool?.end();
  }

  private async checkWebsocketReadiness(): Promise<ReadinessCheck | null> {
    const url = buildWebsocketReadinessUrl(
      process.env.ACTIVEPIECES_WEBSOCKET_READINESS_URL ??
        process.env.ACTIVEPIECES_BASE_URL ??
        this.env.ACTIVEPIECES_BASE_URL,
    );
    if (!url) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        await probeWebsocket(url, 2_000);
        return pass(
          'ap.websocket',
          'ActivePieces websocket endpoint upgrades successfully.',
        );
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/plain,*/*',
        },
      });
      if (response.ok) {
        return pass(
          'ap.websocket',
          'ActivePieces websocket endpoint responds.',
        );
      }
      return warn(
        'ap.websocket',
        'AP_WEBSOCKET_UNAVAILABLE',
        `ActivePieces websocket readiness returned HTTP ${response.status}.`,
      );
    } catch (error) {
      return warn(
        'ap.websocket',
        'AP_WEBSOCKET_UNAVAILABLE',
        `ActivePieces websocket readiness failed: ${
          error instanceof Error ? error.message : 'unknown'
        }.`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private getActivepiecesPool() {
    if (this.apPool) {
      return this.apPool;
    }

    this.apPool = new Pool({
      host: this.env.ACTIVEPIECES_POSTGRES_HOST,
      port: this.env.ACTIVEPIECES_POSTGRES_PORT,
      database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
      user: this.env.ACTIVEPIECES_POSTGRES_USERNAME,
      password: readSecret(
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD,
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
      ),
    });
    return this.apPool;
  }
}

const STAGE17_ACTIVEPIECES_PLATFORM_ID = 'lfstg17platform000001';
const ACTIVEPIECES_CANVAS_REFRESH_POLICY = {
  strategy: 'no_foreground_refresh',
  recover_on: ['auth', 'invalid_access', 'stuck_loading'],
} as const;

function buildVersionCheck(input: {
  readonly runtimeVersion: string | null;
  readonly sdkVersion: string | null;
}): ReadinessCheck {
  if (
    input.runtimeVersion &&
    input.sdkVersion &&
    compareVersions(input.sdkVersion, '0.9.0') >= 0 &&
    compareVersions(input.runtimeVersion, '0.82.0') < 0
  ) {
    return fail(
      'ap.version',
      'ACTIVEPIECES_VERSION_MISMATCH',
      `ActivePieces SDK ${input.sdkVersion} requires runtime 0.82.0+, current runtime is ${input.runtimeVersion}.`,
    );
  }

  if (!input.runtimeVersion || !input.sdkVersion) {
    return warn(
      'ap.version',
      'ACTIVEPIECES_VERSION_MISMATCH',
      'ActivePieces runtime or SDK version is not declared; readiness cannot prove compatibility.',
    );
  }

  return pass(
    'ap.version',
    `ActivePieces runtime ${input.runtimeVersion} is compatible with SDK ${input.sdkVersion}.`,
  );
}

function pass(name: string, message: string): ReadinessCheck {
  return {
    name,
    status: 'pass',
    message,
  };
}

function warn(
  name: string,
  code: AutomationCanvasReadinessCode,
  message: string,
): ReadinessCheck {
  return {
    name,
    status: 'warn',
    code,
    message,
  };
}

function fail(
  name: string,
  code: AutomationCanvasReadinessCode,
  message: string,
): ReadinessCheck {
  return {
    name,
    status: 'fail',
    code,
    message,
  };
}

function buildReadinessVersion(input: {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly automationId: string;
  readonly activepiecesProjectId: string | null;
  readonly activepiecesUserId: string | null;
  readonly activepiecesFlowId: string | null;
  readonly activepiecesFlowVersionId: string | null;
  readonly runtimeVersion: string | null;
  readonly sdkVersion: string | null;
  readonly checks: readonly ReadinessCheck[];
}) {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 24);
}

function buildWebsocketReadinessUrl(baseUrl: string | null | undefined) {
  const value = baseUrl?.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith('ws://') || value.startsWith('wss://')) {
    return value;
  }
  if (value.includes('/socket.io/')) {
    return value;
  }
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  return `${normalized}/api/socket.io/?EIO=4&transport=polling&t=readiness`;
}

function buildActivepiecesInitialRoute(runtimeFlowId: string | null) {
  if (!runtimeFlowId) {
    return '/flows';
  }

  return `/flows/${encodeURIComponent(runtimeFlowId)}`;
}

function probeWebsocket(url: string, timeoutMs: number): Promise<void> {
  const WebSocketCtor = (
    globalThis as typeof globalThis & { WebSocket?: WebSocketProbeConstructor }
  ).WebSocket;
  if (!WebSocketCtor) {
    return Promise.reject(new Error('global WebSocket is not available'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocketCtor(url);
    const timeout = setTimeout(() => {
      finish(new Error('websocket readiness timed out'));
    }, timeoutMs);

    const finish = (error: Error | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // The probe is best-effort; close errors are not readiness failures.
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.addEventListener('open', () => finish(null), { once: true });
    socket.addEventListener(
      'error',
      () => finish(new Error('websocket readiness failed during upgrade')),
      { once: true },
    );
    socket.addEventListener(
      'close',
      () => finish(new Error('websocket readiness closed before upgrade')),
      { once: true },
    );
  });
}

function normalizeOptionalVersion(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized.replace(/^v/, '');
}

function extractSdkVersion(value: string | null | undefined) {
  const match = value?.match(
    /embed-sdk-(\d+\.\d+\.\d+)\.js|\/(\d+\.\d+\.\d+)\.js/,
  );
  return match?.[1] ?? match?.[2] ?? null;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function messageForReadinessCode(code: AutomationCanvasReadinessCode) {
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
    default:
      return 'ActivePieces Canvas is not ready.';
  }
}

function readSecret(envValue: string, filePath: string) {
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return envValue;
}
