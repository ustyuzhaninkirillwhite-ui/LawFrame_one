export interface ActivepiecesBridgeConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly serviceToken?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchLike;
}

export type FetchLike = (
  input: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly text: () => Promise<string>;
}>;

export interface ActivepiecesProjectRequest {
  readonly displayName: string;
  readonly externalId?: string;
  readonly ownerEmail?: string;
}

export interface ActivepiecesFlowRequest {
  readonly projectId: string;
  readonly displayName: string;
  readonly folderId?: string | null;
  readonly version?: unknown;
}

export interface ActivepiecesConnectionRequest {
  readonly projectId: string;
  readonly pieceName: string;
  readonly connectionName: string;
  readonly externalId?: string;
  readonly values?: Record<string, unknown>;
}

export interface ActivepiecesRunRequest {
  readonly projectId: string;
  readonly flowId: string;
  readonly payload?: Record<string, unknown>;
}

export interface ActivepiecesBridgeClient {
  readonly request: <T>(
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<T>;
  readonly listProjects: () => Promise<unknown>;
  readonly createProject: (request: ActivepiecesProjectRequest) => Promise<unknown>;
  readonly getFlow: (flowId: string) => Promise<unknown>;
  readonly createFlow: (request: ActivepiecesFlowRequest) => Promise<unknown>;
  readonly updateFlow: (
    flowId: string,
    request: Partial<ActivepiecesFlowRequest>,
  ) => Promise<unknown>;
  readonly listConnections: (projectId: string) => Promise<unknown>;
  readonly upsertConnection: (
    request: ActivepiecesConnectionRequest,
  ) => Promise<unknown>;
  readonly startRun: (request: ActivepiecesRunRequest) => Promise<unknown>;
}

export function createActivepiecesBridge(
  config: ActivepiecesBridgeConfig,
): ActivepiecesBridgeClient {
  const normalizedBaseUrl = config.baseUrl.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('Activepieces bridge requires fetch implementation.');
  }

  async function request<T>(
    method: string,
    apiPath: string,
    body?: unknown,
  ): Promise<T> {
    const controller = typeof AbortController === 'undefined'
      ? null
      : new AbortController();
    const timeout = controller
      ? setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000)
      : null;

    try {
      const response = await fetchImpl(`${normalizedBaseUrl}${normalizeApiPath(apiPath)}`, {
        method,
        headers: buildHeaders(config, body),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
      });
      const text = await response.text();
      const payload = text ? safeParseJson(text) : null;

      if (!response.ok) {
        throw new ActivepiecesBridgeError(
          response.status,
          response.statusText,
          payload,
        );
      }

      return payload as T;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  return {
    request,
    listProjects: () => request('GET', '/v1/projects'),
    createProject: (project) => request('POST', '/v1/projects', project),
    getFlow: (flowId) => request('GET', `/v1/flows/${encodeURIComponent(flowId)}`),
    createFlow: (flow) => request('POST', '/v1/flows', flow),
    updateFlow: (flowId, flow) =>
      request('PATCH', `/v1/flows/${encodeURIComponent(flowId)}`, flow),
    listConnections: (projectId) =>
      request('GET', `/v1/app-connections?projectId=${encodeURIComponent(projectId)}`),
    upsertConnection: (connection) =>
      request('POST', '/v1/app-connections', connection),
    startRun: (run) => request('POST', '/v1/flow-runs', run),
  };
}

export class ActivepiecesBridgeError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly payload: unknown,
  ) {
    super(`Activepieces API request failed: ${status} ${statusText}`);
  }
}

export function redactBridgeBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactBridgeBody(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/secret|token|password|apiKey|privateKey|serviceRole/i.test(key)) {
      output[key] = '[redacted-by-lexframe-bridge]';
    } else {
      output[key] = redactBridgeBody(child);
    }
  }
  return output;
}

function buildHeaders(
  config: ActivepiecesBridgeConfig,
  body: unknown,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.serviceToken) {
    headers['X-LexFrame-Service-Token'] = config.serviceToken;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function normalizeApiPath(apiPath: string): string {
  return apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
