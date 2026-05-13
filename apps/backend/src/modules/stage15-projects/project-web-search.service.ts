import type {
  ProjectWebSearchRequest,
  ProjectWebSearchResponse,
  ProjectWebSearchResult,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESULTS = 5;
const MAX_ALLOWED_RESULTS = 10;

interface TavilySearchResult {
  readonly title?: unknown;
  readonly url?: unknown;
  readonly content?: unknown;
  readonly snippet?: unknown;
  readonly score?: unknown;
}

interface WebSearchResultRow {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly score: number | null;
  readonly created_at: string;
}

@Injectable()
export class ProjectWebSearchService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async search(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: ProjectWebSearchRequest,
  ): Promise<ProjectWebSearchResponse> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.assertProjectExists(access, projectId);

    const query = sanitizeText(input.query, 500);
    if (!query) {
      return {
        provider: 'tavily',
        status: 'failed',
        items: [],
        error: {
          code: 'invalid_query',
          message: 'Search query is required.',
        },
      };
    }

    const provider = process.env.LEXFRAME_WEB_SEARCH_PROVIDER ?? 'tavily';
    const apiKey = process.env.LEXFRAME_TAVILY_API_KEY?.trim();
    if (provider !== 'tavily' || !apiKey) {
      return {
        provider: 'tavily',
        status: 'unconfigured',
        items: [],
        error: {
          code: 'provider_unconfigured',
          message: 'Web search provider is not configured.',
        },
      };
    }

    const maxResults = clampNumber(
      input.maxResults ??
        parseNumber(process.env.LEXFRAME_WEB_SEARCH_MAX_RESULTS),
      1,
      MAX_ALLOWED_RESULTS,
      DEFAULT_MAX_RESULTS,
    );
    const timeoutMs = clampNumber(
      parseNumber(process.env.LEXFRAME_WEB_SEARCH_TIMEOUT_MS),
      1_000,
      30_000,
      DEFAULT_TIMEOUT_MS,
    );

    try {
      const tavilyResults = await this.queryTavily(
        query,
        apiKey,
        maxResults,
        timeoutMs,
      );
      const items = normalizeTavilyResults(tavilyResults).slice(0, maxResults);
      const savedItems = input.saveResults
        ? await this.persistResults({
            actor,
            items,
            projectId,
            query,
            workspaceId,
          })
        : items;

      return {
        provider: 'tavily',
        status: 'ok',
        items: savedItems,
        error: null,
      };
    } catch {
      return {
        provider: 'tavily',
        status: 'failed',
        items: [],
        error: {
          code: 'provider_failed',
          message: 'Web search is temporarily unavailable.',
        },
      };
    }
  }

  private async queryTavily(
    query: string,
    apiKey: string,
    maxResults: number,
    timeoutMs: number,
  ): Promise<readonly TavilySearchResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Tavily request failed.');
      }

      const payload = (await response.json()) as { readonly results?: unknown };
      return Array.isArray(payload.results)
        ? (payload.results as readonly TavilySearchResult[])
        : [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async persistResults(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly projectId: string;
    readonly query: string;
    readonly items: readonly ProjectWebSearchResult[];
  }): Promise<readonly ProjectWebSearchResult[]> {
    const savedItems: ProjectWebSearchResult[] = [];

    for (const item of input.items) {
      const row = await this.databaseService.one<WebSearchResultRow>(
        `
          insert into app.project_web_search_results (
            workspace_id,
            project_id,
            provider,
            query,
            title,
            url,
            url_hash,
            snippet,
            score,
            created_by,
            metadata
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (workspace_id, project_id, provider, url_hash) do update
          set
            query = excluded.query,
            title = excluded.title,
            url = excluded.url,
            snippet = excluded.snippet,
            score = excluded.score,
            metadata = excluded.metadata
          returning id, title, url, snippet, score, created_at
        `,
        [
          input.workspaceId,
          input.projectId,
          'tavily',
          input.query,
          item.title,
          item.url,
          hashValue(item.url),
          item.snippet,
          item.score ?? null,
          input.actor.id,
          { source: 'project_workspace_web_search' },
        ],
      );

      if (!row) {
        continue;
      }

      const knowledgeRow = await this.databaseService.one<{
        readonly id: string;
      }>(
        `
          insert into app.project_knowledge_items (
            workspace_id,
            project_id,
            source_type,
            source_id,
            mode,
            classification,
            pinned,
            enabled_for_chat,
            citation_required,
            metadata,
            created_by
          )
          values ($1, $2, 'web_search_result', $3, 'reference_only', 'public', false, true, true, $4, $5)
          on conflict do nothing
          returning id
        `,
        [
          input.workspaceId,
          input.projectId,
          row.id,
          {
            title: row.title,
            summary: row.snippet,
            url: row.url,
            provider: 'tavily',
          },
          input.actor.id,
        ],
      );

      savedItems.push({
        id: row.id,
        title: row.title,
        url: row.url,
        snippet: row.snippet,
        sourceType: 'web_search_result',
        score: row.score,
        knowledgeItemId: knowledgeRow?.id ?? null,
        createdAt: row.created_at,
      });
    }

    if (savedItems.length > 0) {
      await this.auditService.record({
        actorUserId: input.actor.id,
        actorEmail: input.actor.email,
        workspaceId: input.workspaceId,
        action: 'project.web_search.results_saved',
        entityType: 'project',
        entityId: input.projectId,
        result: 'success',
        eventCategory: 'chat',
        metadata: {
          project_id: input.projectId,
          provider: 'tavily',
          result_count: savedItems.length,
        },
      });
    }

    return savedItems;
  }

  private requireContext(context: LexframeRequestState | undefined): {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
  } {
    if (!context?.actor || !context.access) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace access context was not attached.',
      );
    }

    return { actor: context.actor, access: context.access };
  }

  private requireWorkspace(access: AccessContext) {
    if (!access.activeWorkspace) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Active workspace is required.',
      );
    }

    return access.activeWorkspace;
  }

  private async assertProjectExists(
    access: AccessContext,
    projectId: string,
  ): Promise<void> {
    const workspace = this.requireWorkspace(access);
    const row = await this.databaseService.one<{
      readonly id: string;
    }>(
      `
        select id
        from app.projects
        where workspace_id = $1
          and id = $2
          and status <> 'archived'
      `,
      [workspace.id, projectId],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }
  }
}

function normalizeTavilyResults(
  results: readonly TavilySearchResult[],
): readonly ProjectWebSearchResult[] {
  return results.flatMap((result) => {
    const url = normalizeUrl(result.url);
    if (!url) {
      return [];
    }

    const title = sanitizeText(result.title, 180) || url;
    const snippet = sanitizeText(result.content ?? result.snippet, 500);
    return [
      {
        id: `web_${hashValue(url).slice(0, 16)}`,
        title,
        url,
        snippet,
        sourceType: 'web_search_result',
        score: normalizeScore(result.score),
        knowledgeItemId: null,
        createdAt: null,
      },
    ];
  });
}

function sanitizeText(value: unknown, maxLength: number): string {
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? `${value}`
        : '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function normalizeScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(
  value: number | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}
