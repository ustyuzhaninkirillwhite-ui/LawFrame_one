import type {
  DataClassification,
  LegalAnalysisArgument,
  LegalAnalysisFact,
  LegalAnalysisIssue,
  LegalAnalysisOutput,
  RagAnalyzeRequest,
  RagRequestSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { SearchCandidate } from '../legal-search/legal-search.service';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AiProviderRegistry } from '../ai-gateway/ai-provider.adapters';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LegalSearchService } from '../legal-search/legal-search.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface RagRequestRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly user_id: string;
  readonly task_type: string;
  readonly question: string;
  readonly query_hash: string;
  readonly selected_source_ids: readonly string[] | null;
  readonly selected_document_ids: readonly string[] | null;
  readonly ai_route: RagRequestSummary['aiRoute'];
  readonly data_classification: DataClassification;
  readonly status: RagRequestSummary['status'];
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

interface RagOutputRow {
  readonly validation_status: RagRequestSummary['validationStatus'];
  readonly citation_validation_status: RagRequestSummary['citationValidationStatus'];
  readonly unsupported_count: number;
  readonly risk_flags: readonly string[] | null;
  readonly output_json: LegalAnalysisOutput | null;
}

@Injectable()
export class LegalRagService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly legalSearchService: LegalSearchService,
  ) {}

  async analyze(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: RagAnalyzeRequest,
    meta: RequestMeta,
  ): Promise<RagRequestSummary> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Для юридического RAG требуется активное рабочее пространство.',
      );
    }

    const contextCandidates = await this.buildContextCandidates(
      actor,
      access,
      input,
    );
    const classification = deriveClassification(contextCandidates);
    const routePlan = await this.aiGatewayService.planStructuredRoute({
      access,
      classification,
      taskType: 'document_analysis',
      hasDocuments:
        contextCandidates.length > 0 ||
        (input.workspaceDocumentIds?.length ?? 0) > 0,
    });
    const requestId = await this.createRagRequest(
      actor.id,
      workspaceId,
      input,
      routePlan.route,
      classification,
      routePlan.blocked ? 'blocked' : 'running',
    );

    if (routePlan.blocked) {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'ai_route_blocked',
        entityType: 'rag_request',
        entityId: requestId,
        result: 'denied',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          reasonCode: routePlan.blockedReasonCode,
          message: routePlan.blockedMessage,
          classification,
        },
      });

      return this.getRequestSummary(workspaceId, requestId);
    }

    await this.persistContextItems(workspaceId, requestId, contextCandidates);

    const fallback = buildFallbackAnalysis(input.question, contextCandidates);
    const prompt = buildPrompt(input, contextCandidates);
    const adapter = this.aiProviderRegistry.get(routePlan.provider!);
    const response = await adapter.generateStructured({
      provider: routePlan.provider!,
      model: routePlan.model ?? 'local-mock',
      prompt,
      schemaId: 'lexframe.legal_analysis.v1',
      fallback,
    });
    const validated = validateAnalysisOutput(
      response.output,
      contextCandidates,
      input.options?.requireCitations ?? true,
      input.options?.includeUnsupportedClaims ?? true,
    );

    await this.databaseService.query(
      `
        insert into app.rag_outputs (
          id,
          rag_request_id,
          workspace_id,
          schema_version,
          output_json,
          validation_status,
          citation_validation_status,
          unsupported_count,
          risk_flags
        )
        values (
          gen_random_uuid(),
          $1,
          $2,
          'lexframe.legal_analysis.v1',
          $3::jsonb,
          $4,
          $5,
          $6,
          $7::jsonb
        )
        on conflict (rag_request_id) do update
        set
          output_json = excluded.output_json,
          validation_status = excluded.validation_status,
          citation_validation_status = excluded.citation_validation_status,
          unsupported_count = excluded.unsupported_count,
          risk_flags = excluded.risk_flags,
          updated_at = timezone('utc', now())
      `,
      [
        requestId,
        workspaceId,
        JSON.stringify(validated.output),
        validated.validationStatus,
        validated.citationValidationStatus,
        validated.output.unsupportedClaims.length,
        JSON.stringify(validated.output.riskFlags),
      ],
    );

    await this.databaseService.query(
      `
        update app.rag_requests
        set
          status = 'completed',
          updated_at = timezone('utc', now()),
          completed_at = timezone('utc', now())
        where id = $1
      `,
      [requestId],
    );

    for (const sourceId of new Set(
      contextCandidates.map((item) => item.source.id),
    )) {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'legal_source_used_in_rag',
        entityType: 'legal_source',
        entityId: sourceId,
        result: 'success',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          ragRequestId: requestId,
          aiRoute: routePlan.route,
        },
      });
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'legal.rag.completed',
      entityType: 'rag_request',
      entityId: requestId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        aiRoute: routePlan.route,
        provider: routePlan.provider,
        model: routePlan.model,
        contextCount: contextCandidates.length,
      },
    });

    return this.getRequestSummary(workspaceId, requestId);
  }

  async getRequestSummary(
    workspaceId: string,
    requestId: string,
  ): Promise<RagRequestSummary> {
    const requestRow = await this.databaseService.one<RagRequestRow>(
      `
        select
          id,
          workspace_id,
          user_id,
          task_type,
          question,
          query_hash,
          selected_source_ids,
          selected_document_ids,
          ai_route,
          data_classification,
          status,
          created_at,
          updated_at,
          completed_at
        from app.rag_requests
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [requestId, workspaceId],
    );

    if (!requestRow) {
      throw new AppHttpException(
        'RAG_REQUEST_NOT_FOUND',
        404,
        'Юридический RAG-запрос не найден в активном рабочем пространстве.',
      );
    }

    const outputRow = await this.databaseService.one<RagOutputRow>(
      `
        select
          validation_status,
          citation_validation_status,
          unsupported_count,
          risk_flags,
          output_json
        from app.rag_outputs
        where rag_request_id = $1
        limit 1
      `,
      [requestId],
    );

    return {
      id: requestRow.id,
      workspaceId: requestRow.workspace_id,
      userId: requestRow.user_id,
      taskType: requestRow.task_type,
      question: requestRow.question,
      queryHash: requestRow.query_hash,
      selectedSourceIds: requestRow.selected_source_ids ?? [],
      selectedDocumentIds: requestRow.selected_document_ids ?? [],
      aiRoute: requestRow.ai_route,
      dataClassification: requestRow.data_classification,
      status: requestRow.status,
      validationStatus: outputRow?.validation_status ?? 'warning',
      citationValidationStatus:
        outputRow?.citation_validation_status ?? 'warning',
      unsupportedCount: Number(outputRow?.unsupported_count ?? 0),
      riskFlags: outputRow?.risk_flags ?? [],
      output: outputRow?.output_json ?? null,
      createdAt: requestRow.created_at,
      updatedAt: requestRow.updated_at,
      completedAt: requestRow.completed_at,
    };
  }

  private async buildContextCandidates(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: RagAnalyzeRequest,
  ): Promise<readonly SearchCandidate[]> {
    const limit = clampContextLimit(input.options?.maxContextChunks ?? 6);
    const selectedIds = input.sourceSelection.selectedSourceIds ?? [];
    const groups: SearchCandidate[][] = [];

    if (
      input.sourceSelection.mode === 'selected_only' ||
      input.sourceSelection.mode === 'selected_and_search'
    ) {
      if (selectedIds.length > 0) {
        groups.push([
          ...(await this.legalSearchService.loadContextCandidates(
            actor,
            access,
            {
              sourceIds: selectedIds,
              limit: limit * 2,
            },
          )),
        ]);
      }
    }

    if (
      input.sourceSelection.mode === 'search_only' ||
      input.sourceSelection.mode === 'selected_and_search'
    ) {
      groups.push([
        ...(await this.legalSearchService.loadContextCandidates(actor, access, {
          sourceIds:
            input.sourceSelection.mode === 'selected_and_search'
              ? selectedIds
              : undefined,
          query: input.sourceSelection.searchQuery ?? input.question,
          filters: input.sourceSelection.filters,
          limit: limit * 3,
        })),
      ]);
    }

    const merged = groups.flat();
    const seenChunks = new Set<string>();
    const perSource = new Map<string, number>();
    const output: SearchCandidate[] = [];

    for (const candidate of merged) {
      if (seenChunks.has(candidate.chunk.id)) {
        continue;
      }

      const sourceCount = perSource.get(candidate.source.id) ?? 0;
      if (sourceCount >= 2) {
        continue;
      }

      seenChunks.add(candidate.chunk.id);
      perSource.set(candidate.source.id, sourceCount + 1);
      output.push(candidate);

      if (output.length >= limit) {
        break;
      }
    }

    return output;
  }

  private async createRagRequest(
    userId: string,
    workspaceId: string,
    input: RagAnalyzeRequest,
    route: RagRequestSummary['aiRoute'],
    classification: DataClassification,
    status: RagRequestSummary['status'],
  ) {
    const requestId = cryptoHash(
      `${workspaceId}:${userId}:${Date.now()}:${input.question}`,
    ).slice(0, 32);
    await this.databaseService.query(
      `
        insert into app.rag_requests (
          id,
          workspace_id,
          user_id,
          task_type,
          question,
          query_hash,
          selected_source_ids,
          selected_document_ids,
          ai_route,
          data_classification,
          status
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9,
          $10,
          $11
        )
      `,
      [
        requestId,
        workspaceId,
        userId,
        input.taskType,
        input.question,
        cryptoHash(input.question),
        JSON.stringify(input.sourceSelection.selectedSourceIds ?? []),
        JSON.stringify(input.workspaceDocumentIds ?? []),
        route,
        classification,
        status,
      ],
    );

    return requestId;
  }

  private async persistContextItems(
    workspaceId: string,
    requestId: string,
    contextCandidates: readonly SearchCandidate[],
  ) {
    await this.databaseService.query(
      `delete from app.rag_context_items where rag_request_id = $1`,
      [requestId],
    );

    let rank = 0;
    for (const candidate of contextCandidates) {
      await this.databaseService.query(
        `
          insert into app.rag_context_items (
            id,
            rag_request_id,
            workspace_id,
            chunk_id,
            source_id,
            document_version_id,
            rank,
            score,
            selection_reason,
            token_count,
            citation_label
          )
          values (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10
          )
        `,
        [
          requestId,
          workspaceId,
          candidate.chunk.id,
          candidate.source.id,
          candidate.chunk.documentVersionId,
          rank,
          candidate.combinedScore,
          candidate.highlights[0] ?? 'context_builder',
          estimateTokens(candidate.chunk.text),
          candidate.citation.citationId,
        ],
      );
      rank += 1;
    }
  }
}

function deriveClassification(
  candidates: readonly SearchCandidate[],
): DataClassification {
  const classifications = new Set(
    candidates.map((candidate) => candidate.source.classification),
  );

  if (classifications.has('legal_secret')) {
    return 'legal_secret';
  }

  if (
    classifications.has('confidential') ||
    classifications.has('personal_data') ||
    classifications.has('client_material')
  ) {
    return 'confidential';
  }

  if (classifications.has('internal')) {
    return 'internal';
  }

  return 'public';
}

function buildFallbackAnalysis(
  question: string,
  contextCandidates: readonly SearchCandidate[],
): LegalAnalysisOutput {
  const citations = contextCandidates.map((candidate) => candidate.citation);
  const facts: LegalAnalysisFact[] = contextCandidates
    .slice(0, 3)
    .map((candidate) => ({
      text: candidate.snippet,
      citations: [candidate.citation.citationId],
    }));
  const legalIssues: LegalAnalysisIssue[] =
    contextCandidates.length > 0
      ? [
          {
            issue: question,
            analysis:
              'Контекст найденной практики нужно соотнести с фактами дела и процессуальной стадией. Вывод ниже ограничен доступными источниками.',
            citations: [contextCandidates[0]!.citation.citationId],
          },
        ]
      : [];
  const argumentsList: LegalAnalysisArgument[] = uniqueBySource(
    contextCandidates,
  )
    .slice(0, 3)
    .map((candidate, index) => ({
      position:
        index === 0
          ? 'Основной аргумент'
          : index === 1
            ? 'Дополнительный аргумент'
            : 'Резервный аргумент',
      analysis: candidate.snippet,
      supportingSources: [candidate.source.title],
      strength:
        candidate.combinedScore >= 0.95
          ? 'high'
          : candidate.combinedScore >= 0.6
            ? 'medium'
            : 'low',
      citations: [candidate.citation.citationId],
    }));

  return {
    summary:
      contextCandidates.length > 0
        ? `Собран контекст по вопросу "${question}" из ${new Set(contextCandidates.map((candidate) => candidate.source.id)).size} источников.`
        : `По вопросу "${question}" контекст не найден. Анализ ограничен отсутствием источников.`,
    facts,
    legalIssues,
    arguments: argumentsList,
    citations,
    unsupportedClaims:
      contextCandidates.length > 0
        ? []
        : [
            'Недостаточно подтвержденных источников для аргументированного вывода.',
          ],
    riskFlags:
      contextCandidates.length > 0
        ? ['server_validated_citations']
        : ['no_context', 'server_validated_citations'],
  };
}

function buildPrompt(
  input: RagAnalyzeRequest,
  contextCandidates: readonly SearchCandidate[],
) {
  const contextText = contextCandidates
    .map(
      (candidate, index) =>
        `[${index + 1}] ${candidate.citation.citationId} | ${candidate.source.title}\n${candidate.chunk.text}`,
    )
    .join('\n\n');

  return [
    `Task: ${input.taskType}`,
    `Question: ${input.question}`,
    'Отвечай строго в формате подтверждённого юридического анализа со стабильными ID источников.',
    'Контекст:',
    contextText || 'Контекст не предоставлен.',
  ].join('\n\n');
}

function validateAnalysisOutput(
  output: LegalAnalysisOutput,
  contextCandidates: readonly SearchCandidate[],
  requireCitations: boolean,
  includeUnsupportedClaims: boolean,
): {
  readonly output: LegalAnalysisOutput;
  readonly validationStatus: RagRequestSummary['validationStatus'];
  readonly citationValidationStatus: RagRequestSummary['citationValidationStatus'];
} {
  const validIds = new Set(
    contextCandidates.map((candidate) => candidate.citation.citationId),
  );
  const citations = output.citations.filter((citation) =>
    validIds.has(citation.citationId),
  );
  const invalidCitationSeen = output.citations.length !== citations.length;
  const unsupportedClaims = [...output.unsupportedClaims];
  const facts: LegalAnalysisFact[] = [];
  for (const fact of output.facts) {
    const validCitations = fact.citations.filter((citation) =>
      validIds.has(citation),
    );
    if (requireCitations && validCitations.length === 0) {
      unsupportedClaims.push(fact.text);
      continue;
    }

    facts.push({
      ...fact,
      citations: validCitations,
    });
  }

  const legalIssues: LegalAnalysisIssue[] = [];
  for (const issue of output.legalIssues) {
    const validCitations = issue.citations.filter((citation) =>
      validIds.has(citation),
    );
    if (requireCitations && validCitations.length === 0) {
      unsupportedClaims.push(issue.analysis);
      continue;
    }

    legalIssues.push({
      ...issue,
      citations: validCitations,
    });
  }

  const argumentsList: LegalAnalysisArgument[] = [];
  for (const argument of output.arguments) {
    const validCitations = argument.citations.filter((citation) =>
      validIds.has(citation),
    );
    if (requireCitations && validCitations.length === 0) {
      unsupportedClaims.push(argument.analysis);
      continue;
    }

    argumentsList.push({
      ...argument,
      citations: validCitations,
    });
  }

  const nextUnsupportedClaims = includeUnsupportedClaims
    ? Array.from(new Set(unsupportedClaims))
    : [];
  const riskFlags = Array.from(
    new Set([
      ...output.riskFlags,
      ...(invalidCitationSeen ? ['invalid_citation_detected'] : []),
      ...(nextUnsupportedClaims.length > 0
        ? ['unsupported_claims_present']
        : []),
      'server_validated_citations',
    ]),
  );

  return {
    output: {
      ...output,
      facts,
      legalIssues,
      arguments: argumentsList,
      citations,
      unsupportedClaims: nextUnsupportedClaims,
      riskFlags,
    },
    validationStatus: nextUnsupportedClaims.length > 0 ? 'warning' : 'valid',
    citationValidationStatus: invalidCitationSeen ? 'warning' : 'valid',
  };
}

function uniqueBySource(candidates: readonly SearchCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.source.id)) {
      return false;
    }

    seen.add(candidate.source.id);
    return true;
  });
}

function clampContextLimit(value: number) {
  return Math.min(Math.max(2, Math.floor(value)), 12);
}

function cryptoHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
