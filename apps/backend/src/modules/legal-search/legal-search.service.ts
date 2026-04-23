import type {
  LegalCitation,
  LegalChunkSummary,
  LegalSearchFacet,
  LegalSearchQuery,
  LegalSearchResponse,
  LegalSearchResult,
  LegalSourceSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface SearchRow {
  readonly source_id: string;
  readonly workspace_id: string | null;
  readonly document_id: string | null;
  readonly source_type: LegalSourceSummary['sourceType'];
  readonly jurisdiction: string | null;
  readonly title: string;
  readonly canonical_url: string | null;
  readonly external_id: string | null;
  readonly license_status: LegalSourceSummary['licenseStatus'];
  readonly visibility: LegalSourceSummary['visibility'];
  readonly classification: LegalSourceSummary['classification'];
  readonly status: LegalSourceSummary['status'];
  readonly owner_workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly source_metadata: Record<string, unknown>;
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly provider_id: string;
  readonly provider_code: string;
  readonly provider_name: string;
  readonly provider_type: LegalSourceSummary['provider']['providerType'];
  readonly provider_jurisdiction: string | null;
  readonly provider_access_mode: LegalSourceSummary['provider']['accessMode'];
  readonly provider_is_enabled: boolean;
  readonly indexed_at: string | null;
  readonly has_embeddings: boolean;
  readonly chunk_id: string;
  readonly document_version_id: string;
  readonly chunk_no: number;
  readonly chunk_type: LegalChunkSummary['chunkType'];
  readonly chunk_text: string;
  readonly text_hash: string;
  readonly page_from: number | null;
  readonly page_to: number | null;
  readonly char_start: number | null;
  readonly char_end: number | null;
  readonly chunk_metadata: Record<string, unknown>;
  readonly security_scope: LegalChunkSummary['securityScope'];
  readonly embedding_model: string | null;
  readonly embedding_hash: string | null;
}

export interface SearchCandidate {
  readonly source: LegalSourceSummary;
  readonly chunk: LegalChunkSummary;
  readonly lexicalScore: number;
  readonly semanticScore: number;
  readonly combinedScore: number;
  readonly snippet: string;
  readonly highlights: readonly string[];
  readonly citation: LegalCitation;
}

@Injectable()
export class LegalSearchService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async query(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: LegalSearchQuery,
    meta: RequestMeta,
  ): Promise<LegalSearchResponse> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Для юридического поиска требуется активное рабочее пространство.',
      );
    }

    const candidates = await this.loadCandidates(actor, access, input);
    const total = candidates.length;
    const offset = clampNonNegative(input.offset ?? 0);
    const limit = clampLimit(input.limit ?? 12);
    const results = candidates
      .slice(offset, offset + limit)
      .map((candidate, index) =>
        mapCandidateToResult(candidate, offset + index + 1),
      );

    if (results.length > 0) {
      await this.databaseService.query(
        `
          update app.legal_sources
          set last_used_at = timezone('utc', now())
          where id = any($1::uuid[])
        `,
        [results.map((result) => result.source.id)],
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'legal.search.performed',
      entityType: 'legal_search',
      entityId: null,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        query: input.query,
        mode: input.mode,
        total,
        selectedSources: input.selectedSourceIds ?? [],
      },
    });

    return {
      mode: input.mode,
      total,
      facets: buildFacets(candidates),
      results,
      debug: {
        indexAlias: this.env.OPENSEARCH_INDEX_ALIAS,
        normalized: input.mode !== 'keyword',
        aclApplied: true,
      },
    };
  }

  async loadContextCandidates(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: {
      readonly sourceIds?: readonly string[];
      readonly query?: string;
      readonly filters?: LegalSearchQuery['filters'];
      readonly limit: number;
    },
  ): Promise<readonly SearchCandidate[]> {
    return this.loadCandidates(actor, access, {
      query: input.query ?? '',
      mode: input.query && input.query.trim().length > 0 ? 'hybrid' : 'keyword',
      filters: input.filters,
      limit: input.limit,
      offset: 0,
      selectedSourceIds: input.sourceIds,
    });
  }

  private async loadCandidates(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: LegalSearchQuery,
  ): Promise<readonly SearchCandidate[]> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Для юридического поиска требуется активное рабочее пространство.',
      );
    }

    const values: unknown[] = [workspaceId, actor.id];
    const conditions = [
      buildAccessClause('s', 1, 2),
      "s.status in ('processed', 'indexed', 'pending_processing')",
    ];
    const normalizedQuery = input.query.trim();
    const loweredQuery = normalizedQuery.toLowerCase();

    if (input.selectedSourceIds && input.selectedSourceIds.length > 0) {
      values.push(input.selectedSourceIds);
      conditions.push(`s.id = any($${values.length}::uuid[])`);
    }

    if (input.filters?.sourceType && input.filters.sourceType.length > 0) {
      values.push(input.filters.sourceType);
      conditions.push(`s.source_type = any($${values.length}::text[])`);
    }

    if (input.filters?.visibility && input.filters.visibility.length > 0) {
      values.push(input.filters.visibility);
      conditions.push(`s.visibility = any($${values.length}::text[])`);
    }

    if (input.filters?.court && input.filters.court.length > 0) {
      values.push(input.filters.court);
      conditions.push(
        `coalesce(s.metadata->>'court', c.metadata->>'court') = any($${values.length}::text[])`,
      );
    }

    if (input.filters?.dateFrom) {
      values.push(input.filters.dateFrom);
      conditions.push(
        `coalesce(s.metadata->>'decisionDate', s.metadata->>'decision_date') >= $${values.length}`,
      );
    }

    if (input.filters?.dateTo) {
      values.push(input.filters.dateTo);
      conditions.push(
        `coalesce(s.metadata->>'decisionDate', s.metadata->>'decision_date') <= $${values.length}`,
      );
    }

    if (input.filters?.caseNumber) {
      values.push(input.filters.caseNumber);
      conditions.push(
        `coalesce(s.metadata->>'caseNumber', s.metadata->>'case_number') = $${values.length}`,
      );
    }

    if (input.filters?.category && input.filters.category.length > 0) {
      values.push(input.filters.category);
      conditions.push(
        `exists (
          select 1
          from jsonb_array_elements_text(coalesce(s.metadata->'categories', '[]'::jsonb)) as category
          where category = any($${values.length}::text[])
        )`,
      );
    }

    if (normalizedQuery.length > 0) {
      values.push(`%${normalizedQuery}%`);
      conditions.push(
        `(
          c.text ilike $${values.length}
          or s.title ilike $${values.length}
          or coalesce(s.metadata->>'caseNumber', s.metadata->>'case_number', '') ilike $${values.length}
        )`,
      );
    }

    const result = await this.databaseService.query<SearchRow>(
      `
        select
          s.id as source_id,
          s.workspace_id,
          s.document_id,
          s.source_type,
          s.jurisdiction,
          s.title,
          s.canonical_url,
          s.external_id,
          s.license_status,
          s.visibility,
          s.classification,
          s.status,
          s.owner_workspace_id,
          s.owner_user_id,
          s.metadata as source_metadata,
          s.last_used_at,
          s.created_at,
          s.updated_at,
          p.id as provider_id,
          p.code as provider_code,
          p.name as provider_name,
          p.provider_type,
          p.jurisdiction as provider_jurisdiction,
          p.access_mode as provider_access_mode,
          p.is_enabled as provider_is_enabled,
          c.indexed_at,
          c.embedding_hash is not null as has_embeddings,
          c.id as chunk_id,
          c.document_version_id,
          c.chunk_no,
          c.chunk_type,
          c.text as chunk_text,
          c.text_hash,
          c.page_from,
          c.page_to,
          c.char_start,
          c.char_end,
          c.metadata as chunk_metadata,
          c.security_scope,
          c.embedding_model,
          c.embedding_hash
        from app.legal_chunks c
        inner join app.legal_sources s
          on s.id = c.source_id
        inner join app.legal_source_providers p
          on p.id = s.provider_id
        where ${conditions.join(' and ')}
        order by s.updated_at desc, c.chunk_no asc
        limit 200
      `,
      values,
    );

    const candidates = result.rows
      .map((row) => mapRowToCandidate(row, loweredQuery, input.mode))
      .filter((candidate) =>
        normalizedQuery.length === 0 ? true : candidate.combinedScore > 0,
      )
      .sort((left, right) => right.combinedScore - left.combinedScore);

    return candidates;
  }
}

function buildAccessClause(
  sourceAlias: string,
  workspaceParamIndex: number,
  actorParamIndex: number,
) {
  return `
    (
      ${sourceAlias}.workspace_id = $${workspaceParamIndex}
      or ${sourceAlias}.visibility in ('public', 'product_private')
      or (
        ${sourceAlias}.visibility = 'user_private'
        and ${sourceAlias}.owner_user_id = $${actorParamIndex}
      )
      or exists(
        select 1
        from app.legal_source_access lsa
        where lsa.source_id = ${sourceAlias}.id
          and (
            lsa.workspace_id = $${workspaceParamIndex}
            or lsa.user_id = $${actorParamIndex}
          )
          and (
            lsa.expires_at is null
            or lsa.expires_at > timezone('utc', now())
          )
      )
    )
  `;
}

function mapRowToCandidate(
  row: SearchRow,
  normalizedQuery: string,
  mode: LegalSearchQuery['mode'],
): SearchCandidate {
  const sourceMetadata = normalizeMetadata(row.source_metadata);
  const chunkMetadata = normalizeMetadata(row.chunk_metadata);
  const source = mapSource(row, sourceMetadata);
  const chunk: LegalChunkSummary = {
    id: row.chunk_id,
    sourceId: row.source_id,
    documentVersionId: row.document_version_id,
    chunkNo: Number(row.chunk_no),
    chunkType: row.chunk_type,
    text: row.chunk_text,
    textHash: row.text_hash,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    charStart: row.char_start,
    charEnd: row.char_end,
    metadata: chunkMetadata,
    securityScope: row.security_scope,
    embeddingModel: row.embedding_model,
    embeddingHash: row.embedding_hash,
    indexedAt: row.indexed_at,
  };
  const lexicalScore = computeLexicalScore(
    normalizedQuery,
    row.title,
    row.chunk_text,
    source,
  );
  const semanticScore = computeSemanticScore(
    normalizedQuery,
    row.chunk_text,
    mode,
  );
  const combinedScore =
    mode === 'keyword'
      ? lexicalScore
      : mode === 'semantic'
        ? semanticScore
        : lexicalScore * 0.65 + semanticScore * 0.35;
  const highlights =
    normalizedQuery.length > 0
      ? buildHighlights(normalizedQuery, row.chunk_text)
      : [];
  const snippet = buildSnippet(normalizedQuery, row.chunk_text);
  const citation: LegalCitation = {
    citationId: buildCitationId(row.chunk_id),
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    documentVersionId: row.document_version_id,
    title: row.title,
    quote: snippet,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    court: source.court,
    caseNumber: source.caseNumber,
    decisionDate: source.decisionDate,
    score: roundScore(combinedScore),
  };

  return {
    source,
    chunk,
    lexicalScore: roundScore(lexicalScore),
    semanticScore: roundScore(semanticScore),
    combinedScore: roundScore(combinedScore),
    snippet,
    highlights,
    citation,
  };
}

function mapSource(
  row: SearchRow,
  metadata: Record<string, unknown>,
): LegalSourceSummary {
  return {
    id: row.source_id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    provider: {
      id: row.provider_id,
      code: row.provider_code,
      name: row.provider_name,
      providerType: row.provider_type,
      jurisdiction: row.provider_jurisdiction,
      accessMode: row.provider_access_mode,
      isEnabled: row.provider_is_enabled,
    },
    sourceType: row.source_type,
    jurisdiction: row.jurisdiction,
    title: row.title,
    canonicalUrl: row.canonical_url,
    externalId: row.external_id,
    licenseStatus: row.license_status,
    visibility: row.visibility,
    classification: row.classification,
    status: row.status,
    ownerWorkspaceId: row.owner_workspace_id,
    ownerUserId: row.owner_user_id,
    court: readMetadataString(metadata, 'court'),
    caseNumber:
      readMetadataString(metadata, 'caseNumber') ??
      readMetadataString(metadata, 'case_number'),
    decisionDate:
      readMetadataString(metadata, 'decisionDate') ??
      readMetadataString(metadata, 'decision_date'),
    hasEmbeddings: row.has_embeddings,
    indexedAt: row.indexed_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidateToResult(
  candidate: SearchCandidate,
  rank: number,
): LegalSearchResult {
  return {
    rank,
    score: candidate.combinedScore,
    scoreComponents: {
      lexical: candidate.lexicalScore,
      semantic: candidate.semanticScore,
      combined: candidate.combinedScore,
    },
    source: candidate.source,
    chunk: candidate.chunk,
    snippet: candidate.snippet,
    highlights: candidate.highlights,
    citation: candidate.citation,
  };
}

function buildFacets(
  candidates: readonly SearchCandidate[],
): readonly LegalSearchFacet[] {
  const sourceTypeCounts = new Map<string, number>();
  const courtCounts = new Map<string, number>();
  const visibilityCounts = new Map<string, number>();

  for (const candidate of candidates) {
    incrementCount(sourceTypeCounts, candidate.source.sourceType);
    incrementCount(visibilityCounts, candidate.source.visibility);
    if (candidate.source.court) {
      incrementCount(courtCounts, candidate.source.court);
    }
  }

  return [
    mapFacet('sourceType', 'Source type', sourceTypeCounts),
    mapFacet('court', 'Court', courtCounts),
    mapFacet('visibility', 'Visibility', visibilityCounts),
  ].filter((facet) => facet.buckets.length > 0);
}

function mapFacet(
  name: string,
  label: string,
  counts: Map<string, number>,
): LegalSearchFacet {
  return {
    name,
    label,
    buckets: [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([value, count]) => ({ value, count })),
  };
}

function incrementCount(map: Map<string, number>, value: string) {
  map.set(value, (map.get(value) ?? 0) + 1);
}

function computeLexicalScore(
  query: string,
  title: string,
  text: string,
  source: LegalSourceSummary,
) {
  if (query.length === 0) {
    return 0.45;
  }

  const loweredTitle = title.toLowerCase();
  const loweredText = text.toLowerCase();
  let score = 0;

  if (loweredTitle.includes(query)) {
    score += 0.45;
  }

  if (loweredText.includes(query)) {
    score += 0.4;
  }

  if (source.caseNumber && source.caseNumber.toLowerCase().includes(query)) {
    score += 0.65;
  }

  if (source.court && source.court.toLowerCase().includes(query)) {
    score += 0.15;
  }

  const queryTokens = query.split(/\s+/).filter((token) => token.length > 1);
  const tokenHits = queryTokens.filter(
    (token) => loweredText.includes(token) || loweredTitle.includes(token),
  ).length;

  if (queryTokens.length > 0) {
    score += (tokenHits / queryTokens.length) * 0.35;
  }

  return Math.min(score, 1.5);
}

function computeSemanticScore(
  query: string,
  text: string,
  mode: LegalSearchQuery['mode'],
) {
  if (mode === 'keyword') {
    return 0;
  }

  if (query.length === 0) {
    return 0.35;
  }

  const queryTokens = query.split(/\s+/).filter((token) => token.length > 2);
  if (queryTokens.length === 0) {
    return 0.2;
  }

  const loweredText = text.toLowerCase();
  const hitCount = queryTokens.filter((token) =>
    loweredText.includes(token),
  ).length;
  const density = Math.min(text.length / 1200, 1);

  return Math.min((hitCount / queryTokens.length) * 0.9 + density * 0.1, 1);
}

function buildSnippet(query: string, text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (query.length === 0) {
    return clean.slice(0, 280);
  }

  const index = clean.toLowerCase().indexOf(query);
  if (index === -1) {
    return clean.slice(0, 280);
  }

  const start = Math.max(0, index - 70);
  const end = Math.min(clean.length, index + query.length + 150);
  return clean.slice(start, end).trim();
}

function buildHighlights(query: string, text: string) {
  if (query.length === 0) {
    return [] as const;
  }

  const snippets = text
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.toLowerCase().includes(query))
    .slice(0, 3)
    .map((entry) => entry.slice(0, 220));

  return snippets;
}

function buildCitationId(chunkId: string) {
  return `cit_${chunkId.slice(0, 8)}`;
}

function normalizeMetadata(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return value ?? {};
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampNonNegative(value: number) {
  return Math.max(0, Math.floor(value));
}

function clampLimit(value: number) {
  return Math.min(Math.max(1, Math.floor(value)), 50);
}
