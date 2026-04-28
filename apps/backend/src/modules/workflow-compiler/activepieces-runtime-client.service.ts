import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';

interface ActivepiecesAuthResponse {
  readonly id: string;
  readonly token: string;
  readonly projectId: string;
  readonly platformId: string;
}

interface ActivepiecesProjectResponse {
  readonly id: string;
  readonly displayName?: string;
  readonly externalId?: string | null;
}

interface ActivepiecesFlowResponse {
  readonly id: string;
  readonly projectId: string;
  readonly externalId?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly publishedVersionId?: string | null;
  readonly version?: {
    readonly id: string;
    readonly displayName?: string;
    readonly state?: string;
    readonly trigger?: unknown;
    readonly valid?: boolean;
  };
}

interface ActivepiecesListResponse<T> {
  readonly data?: readonly T[];
}

interface ActivepiecesSession {
  readonly token: string;
  readonly userId: string;
  readonly projectId: string;
  readonly platformId: string;
  readonly expiresAt: number;
}

export interface ActivepiecesProjectRef {
  readonly id: string;
  readonly displayName?: string;
  readonly externalId?: string | null;
}

export interface ActivepiecesFlowRef {
  readonly id: string;
  readonly projectId: string;
  readonly versionId: string | null;
  readonly publishedVersionId: string | null;
  readonly externalId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly raw: ActivepiecesFlowResponse;
}

@Injectable()
export class ActivepiecesRuntimeClient {
  private readonly env = loadServerEnv();
  private session: ActivepiecesSession | null = null;

  async health(): Promise<void> {
    await this.fetchRaw('/', { method: 'GET' }, false);
  }

  async ensureProject(displayName: string): Promise<ActivepiecesProjectRef> {
    const session = await this.getSession();
    const project = await this.request<ActivepiecesProjectResponse>(
      `/users/projects/${encodeURIComponent(session.projectId)}`,
      { method: 'GET' },
      { includeProjectId: false },
    );
    if (displayName && project.displayName !== displayName) {
      try {
        await this.request<ActivepiecesProjectResponse>(
          `/projects/${encodeURIComponent(session.projectId)}`,
          {
            method: 'POST',
            body: JSON.stringify({ displayName }),
          },
          { projectId: session.projectId },
        );
      } catch {
        // Community Activepieces may reject project metadata updates. The
        // project existence/read-back is the runtime invariant; naming is best effort.
      }
    }
    return {
      id: project.id,
      displayName: project.displayName,
      externalId: project.externalId ?? null,
    };
  }

  async getProject(projectId: string): Promise<ActivepiecesProjectRef> {
    const project = await this.request<ActivepiecesProjectResponse>(
      `/users/projects/${encodeURIComponent(projectId)}`,
      { method: 'GET' },
      { includeProjectId: false },
    );
    return {
      id: project.id,
      displayName: project.displayName,
      externalId: project.externalId ?? null,
    };
  }

  async findFlowByExternalId(
    projectId: string,
    externalId: string,
  ): Promise<ActivepiecesFlowRef | null> {
    const page = await this.request<
      ActivepiecesListResponse<ActivepiecesFlowResponse>
    >(
      '/flows',
      { method: 'GET' },
      { projectId, searchParams: { limit: '100' } },
    );
    const match =
      page.data?.find((flow) => flow.externalId === externalId) ?? null;
    return match ? this.toFlowRef(match) : null;
  }

  async findFlowByLexFrameTarget(input: {
    readonly projectId: string;
    readonly workspaceId: string;
    readonly automationId: string;
  }): Promise<ActivepiecesFlowRef | null> {
    const page = await this.request<
      ActivepiecesListResponse<ActivepiecesFlowResponse>
    >(
      '/flows',
      { method: 'GET' },
      { projectId: input.projectId, searchParams: { limit: '100' } },
    );
    const match =
      page.data?.find((flow) => {
        const lexframe = readLexFrameMetadata(flow.metadata);
        return (
          lexframe?.workspaceId === input.workspaceId &&
          lexframe?.automationId === input.automationId
        );
      }) ?? null;
    return match ? this.toFlowRef(match) : null;
  }

  async findFlowByDisplayName(
    projectId: string,
    displayName: string,
  ): Promise<ActivepiecesFlowRef | null> {
    const page = await this.request<
      ActivepiecesListResponse<ActivepiecesFlowResponse>
    >(
      '/flows',
      { method: 'GET' },
      { projectId, searchParams: { limit: '100', name: displayName } },
    );
    const match =
      page.data?.find((flow) => flow.version?.displayName === displayName) ??
      null;
    return match ? this.toFlowRef(match) : null;
  }

  async createFlow(input: {
    readonly projectId: string;
    readonly displayName: string;
    readonly externalId?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<ActivepiecesFlowRef> {
    const created = await this.request<ActivepiecesFlowResponse>(
      '/flows',
      {
        method: 'POST',
        body: JSON.stringify({
          displayName: input.displayName,
          projectId: input.projectId,
          externalId: input.externalId ?? undefined,
          metadata: input.metadata,
        }),
      },
      { includeProjectId: false },
    );
    return this.toFlowRef(created);
  }

  async getFlow(input: {
    readonly projectId: string;
    readonly flowId: string;
    readonly versionId?: string | null;
  }): Promise<ActivepiecesFlowRef> {
    const searchParams: Record<string, string> = {};
    if (input.versionId) {
      searchParams.versionId = input.versionId;
    }
    const flow = await this.request<ActivepiecesFlowResponse>(
      `/flows/${encodeURIComponent(input.flowId)}`,
      { method: 'GET' },
      { projectId: input.projectId, searchParams },
    );
    return this.toFlowRef(flow);
  }

  async applyFlowOperation(input: {
    readonly projectId: string;
    readonly flowId: string;
    readonly operation: unknown;
  }): Promise<ActivepiecesFlowRef> {
    const updated = await this.request<ActivepiecesFlowResponse>(
      `/flows/${encodeURIComponent(input.flowId)}`,
      {
        method: 'POST',
        body: JSON.stringify(input.operation),
      },
      { projectId: input.projectId },
    );
    return this.toFlowRef(updated);
  }

  private toFlowRef(flow: ActivepiecesFlowResponse): ActivepiecesFlowRef {
    return {
      id: flow.id,
      projectId: flow.projectId,
      versionId: flow.version?.id ?? flow.publishedVersionId ?? null,
      publishedVersionId: flow.publishedVersionId ?? null,
      externalId: flow.externalId ?? null,
      metadata: flow.metadata ?? null,
      raw: flow,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    options: {
      readonly projectId?: string | null;
      readonly includeProjectId?: boolean;
      readonly searchParams?: Record<string, string>;
    } = {},
  ): Promise<T> {
    this.assertRuntimeEnabled();
    const session = await this.getSession();
    const projectId = options.projectId ?? session.projectId;
    const searchParams = new URLSearchParams(options.searchParams ?? {});
    if (options.includeProjectId !== false && projectId) {
      searchParams.set('projectId', projectId);
    }
    const suffix = searchParams.size > 0 ? `?${searchParams}` : '';
    const response = await this.fetchRaw(
      `/api/v1${path}${suffix}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      },
      true,
    );
    return (await response.json()) as T;
  }

  private async getSession(): Promise<ActivepiecesSession> {
    this.assertRuntimeEnabled();
    const now = Date.now();
    if (this.session && this.session.expiresAt - now > 60_000) {
      return this.session;
    }
    const token = this.env.ACTIVEPIECES_API_KEY.trim();
    if (
      token &&
      !token.startsWith('replace_with_') &&
      token !== 'stage0_activepieces_api_key'
    ) {
      const parsed = parseJwt(token);
      if (parsed.projectId && parsed.id && parsed.platformId) {
        this.session = {
          token,
          userId: parsed.id,
          projectId: parsed.projectId,
          platformId: parsed.platformId,
          expiresAt: parsed.exp ? parsed.exp * 1000 : now + 5 * 60_000,
        };
        return this.session;
      }
    }
    this.session = await this.signInOrCreateServiceAccount();
    return this.session;
  }

  private async signInOrCreateServiceAccount(): Promise<ActivepiecesSession> {
    const email = this.env.ACTIVEPIECES_SERVICE_EMAIL;
    const password = this.env.ACTIVEPIECES_SERVICE_PASSWORD;
    const signedIn = await this.authRequest('/api/v1/authentication/sign-in', {
      email,
      password,
    }).catch(async (error) => {
      if (!(error instanceof ActivepiecesRuntimeError)) {
        throw error;
      }
      await this.authRequest('/api/v1/authentication/sign-up', {
        email,
        password,
        firstName: 'LexFrame',
        lastName: 'Stage16',
        trackEvents: false,
        newsLetter: false,
      }).catch((signUpError) => {
        if (
          signUpError instanceof ActivepiecesRuntimeError &&
          signUpError.status >= 400 &&
          signUpError.status < 500
        ) {
          return null;
        }
        throw signUpError;
      });
      return this.authRequest('/api/v1/authentication/sign-in', {
        email,
        password,
      });
    });
    const parsed = parseJwt(signedIn.token);
    return {
      token: signedIn.token,
      userId: signedIn.id,
      projectId: signedIn.projectId,
      platformId: signedIn.platformId,
      expiresAt: parsed.exp ? parsed.exp * 1000 : Date.now() + 5 * 60_000,
    };
  }

  private async authRequest(
    path: string,
    body: Record<string, unknown>,
  ): Promise<ActivepiecesAuthResponse> {
    const response = await this.fetchRaw(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      true,
    );
    return (await response.json()) as ActivepiecesAuthResponse;
  }

  private async fetchRaw(
    path: string,
    init: RequestInit,
    expectOk: boolean,
  ): Promise<Response> {
    const response = await fetch(
      `${this.env.ACTIVEPIECES_BASE_URL.replace(/\/$/, '')}${path}`,
      init,
    );
    if (expectOk && !response.ok) {
      const text = await response.text().catch(() => '');
      throw new ActivepiecesRuntimeError(
        response.status,
        `Activepieces request ${path} failed with ${response.status}: ${text.slice(0, 500)}`,
      );
    }
    return response;
  }

  private assertRuntimeEnabled() {
    if (this.env.ACTIVEPIECES_SIMULATE_RUNS === '1') {
      throw new ActivepiecesRuntimeError(
        503,
        'Activepieces runtime sync requires ACTIVEPIECES_SIMULATE_RUNS=0.',
      );
    }
  }
}

function readLexFrameMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  const lexframe = metadata?.lexframe;
  if (!lexframe || typeof lexframe !== 'object' || Array.isArray(lexframe)) {
    return null;
  }
  return lexframe as {
    readonly workspaceId?: unknown;
    readonly automationId?: unknown;
  };
}

export class ActivepiecesRuntimeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ActivepiecesRuntimeError';
  }
}

function parseJwt(token: string): {
  readonly id?: string;
  readonly projectId?: string;
  readonly platformId?: string;
  readonly exp?: number;
} {
  const [, payload] = token.split('.');
  if (!payload) {
    return {};
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as {
      readonly id?: string;
      readonly projectId?: string;
      readonly platform?: { readonly id?: string };
      readonly exp?: number;
    };
    return {
      id: parsed.id,
      projectId: parsed.projectId,
      platformId: parsed.platform?.id,
      exp: parsed.exp,
    };
  } catch {
    return {};
  }
}
