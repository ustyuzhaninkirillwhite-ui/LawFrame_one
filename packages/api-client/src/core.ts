import type { ApiErrorResponse } from "@lexframe/contracts";

export type MaybePromise<T> = T | Promise<T>;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly requestId: string | null,
    public readonly details: Record<string, unknown> | undefined,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface FetchOptions {
  readonly baseUrl: string;
  readonly headers?:
    | HeadersInit
    | (() => MaybePromise<HeadersInit | undefined>);
  readonly getAccessToken?: () => MaybePromise<string | null | undefined>;
  readonly getWorkspaceId?: () => MaybePromise<string | null | undefined>;
  readonly getReauthToken?: () => MaybePromise<string | null | undefined>;
}

async function resolveHeaders(
  options: FetchOptions,
  init?: RequestInit,
): Promise<HeadersInit> {
  const baseHeaders =
    typeof options.headers === "function"
      ? await options.headers()
      : options.headers;
  const headers = new Headers(baseHeaders);
  const token = options.getAccessToken ? await options.getAccessToken() : null;
  const workspaceId = options.getWorkspaceId
    ? await options.getWorkspaceId()
    : null;
  const reauthToken = options.getReauthToken
    ? await options.getReauthToken()
    : null;

  if (workspaceId) {
    headers.set("x-workspace-id", workspaceId);
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (reauthToken) {
    headers.set("x-reauth-token", reauthToken);
  }

  if (init?.headers) {
    const requestHeaders = new Headers(init.headers);
    requestHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (init?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

export async function requestJson<T>(
  options: FetchOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${options.baseUrl}${path}`, {
    ...init,
    headers: await resolveHeaders(options, init),
  });

  if (!response.ok) {
    let payload: ApiErrorResponse | null = null;

    try {
      payload = (await response.json()) as ApiErrorResponse;
    } catch {
      payload = null;
    }

    throw new ApiClientError(
      payload?.error.message ?? `HTTP ${response.status} for ${path}`,
      response.status,
      payload?.error.code ?? null,
      payload?.requestId ?? response.headers.get("x-request-id"),
      payload?.error.details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function withJsonBody(body: unknown, init?: RequestInit): RequestInit {
  return {
    method: init?.method ?? "POST",
    ...init,
    body: JSON.stringify(body),
  };
}

export function buildQueryString(params: object) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : "";
}
