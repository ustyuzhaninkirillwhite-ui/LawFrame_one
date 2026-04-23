import type {
  ClauseLibraryItemSummary,
  CreateClauseLibraryItemRequest,
  CreatePhraseRuleRequest,
  PhraseRuleSummary,
  UpdateClauseLibraryItemRequest,
  UpdatePhraseRuleRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { type RequestMeta } from '../stage7-support/stage7.helpers';

interface ClauseRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly scope: ClauseLibraryItemSummary['scope'];
  readonly title: string;
  readonly tags: readonly string[];
  readonly status: ClauseLibraryItemSummary['status'];
  readonly rich_text: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

interface PhraseRuleRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly rule_type: PhraseRuleSummary['ruleType'];
  readonly phrase: string;
  readonly rationale: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class ClausesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listClauses(
    access: AccessContext,
    actorId: string | null,
  ): Promise<readonly ClauseLibraryItemSummary[]> {
    const result = await this.databaseService.query<ClauseRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          scope,
          title,
          tags,
          status,
          rich_text,
          created_at,
          updated_at
        from app.clause_library_items
        where deleted_at is null
          and (
            scope = 'system'
            or workspace_id = $1
            or owner_user_id = $2
          )
        order by updated_at desc
      `,
      [access.activeWorkspace!.id, actorId],
    );

    return result.rows.map(mapClauseRow);
  }

  async createClause(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateClauseLibraryItemRequest,
    meta: RequestMeta,
  ): Promise<ClauseLibraryItemSummary> {
    const row = await this.databaseService.one<ClauseRow>(
      `
        insert into app.clause_library_items (
          workspace_id,
          owner_user_id,
          scope,
          title,
          tags,
          status,
          rich_text,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, $3, $4, $5::text[], 'draft', $6::jsonb, $7, $7)
        returning
          id,
          workspace_id,
          owner_user_id,
          scope,
          title,
          tags,
          status,
          rich_text,
          created_at,
          updated_at
      `,
      [
        input.scope === 'system' ? null : access.activeWorkspace!.id,
        input.scope === 'personal' ? actor.id : (input.ownerUserId ?? null),
        input.scope,
        input.title.trim(),
        input.tags ?? [],
        JSON.stringify(input.richText),
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'CLAUSE_CREATE_FAILED',
        500,
        'Clause was not created.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'clause.updated',
      entityType: 'clause_library_item',
      entityId: row.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        scope: row.scope,
      },
    });

    return mapClauseRow(row);
  }

  async updateClause(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: UpdateClauseLibraryItemRequest,
    meta: RequestMeta,
  ): Promise<ClauseLibraryItemSummary> {
    const row = await this.databaseService.one<ClauseRow>(
      `
        update app.clause_library_items
        set
          title = coalesce($2, title),
          tags = coalesce($3::text[], tags),
          rich_text = coalesce($4::jsonb, rich_text),
          status = coalesce($5, status),
          updated_by_user_id = $6,
          updated_at = timezone('utc', now())
        where id = $1
          and deleted_at is null
          and (workspace_id = $7 or owner_user_id = $6 or scope = 'system')
        returning
          id,
          workspace_id,
          owner_user_id,
          scope,
          title,
          tags,
          status,
          rich_text,
          created_at,
          updated_at
      `,
      [
        id,
        input.title?.trim() ?? null,
        input.tags ?? null,
        input.richText ? JSON.stringify(input.richText) : null,
        input.status ?? null,
        actor.id,
        access.activeWorkspace!.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'CLAUSE_NOT_FOUND',
        404,
        'Clause was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'clause.updated',
      entityType: 'clause_library_item',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        status: row.status,
      },
    });

    return mapClauseRow(row);
  }

  async listPhraseRules(
    access: AccessContext,
    actorId: string | null,
  ): Promise<readonly PhraseRuleSummary[]> {
    const result = await this.databaseService.query<PhraseRuleRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          rule_type,
          phrase,
          rationale,
          created_at,
          updated_at
        from app.phrase_rules
        where deleted_at is null
          and (
            workspace_id = $1
            or owner_user_id = $2
            or workspace_id is null
          )
        order by updated_at desc
      `,
      [access.activeWorkspace!.id, actorId],
    );

    return result.rows.map(mapPhraseRuleRow);
  }

  async createPhraseRule(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreatePhraseRuleRequest,
    meta: RequestMeta,
  ): Promise<PhraseRuleSummary> {
    const row = await this.databaseService.one<PhraseRuleRow>(
      `
        insert into app.phrase_rules (
          workspace_id,
          owner_user_id,
          rule_type,
          phrase,
          rationale,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $6)
        returning
          id,
          workspace_id,
          owner_user_id,
          rule_type,
          phrase,
          rationale,
          created_at,
          updated_at
      `,
      [
        access.activeWorkspace!.id,
        input.ownerUserId ?? actor.id,
        input.ruleType,
        input.phrase.trim(),
        input.rationale ?? null,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PHRASE_RULE_CREATE_FAILED',
        500,
        'Phrase rule was not created.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'clause.updated',
      entityType: 'phrase_rule',
      entityId: row.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        ruleType: row.rule_type,
      },
    });

    return mapPhraseRuleRow(row);
  }

  async updatePhraseRule(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: UpdatePhraseRuleRequest,
    meta: RequestMeta,
  ): Promise<PhraseRuleSummary> {
    const row = await this.databaseService.one<PhraseRuleRow>(
      `
        update app.phrase_rules
        set
          phrase = coalesce($2, phrase),
          rationale = coalesce($3, rationale),
          updated_by_user_id = $4,
          updated_at = timezone('utc', now())
        where id = $1
          and deleted_at is null
          and (workspace_id = $5 or owner_user_id = $4)
        returning
          id,
          workspace_id,
          owner_user_id,
          rule_type,
          phrase,
          rationale,
          created_at,
          updated_at
      `,
      [
        id,
        input.phrase?.trim() ?? null,
        input.rationale ?? null,
        actor.id,
        access.activeWorkspace!.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PHRASE_RULE_NOT_FOUND',
        404,
        'Phrase rule was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'clause.updated',
      entityType: 'phrase_rule',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        phrase: row.phrase,
      },
    });

    return mapPhraseRuleRow(row);
  }
}

function mapClauseRow(row: ClauseRow): ClauseLibraryItemSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    scope: row.scope,
    title: row.title,
    tags: row.tags ?? [],
    status: row.status,
    richText: row.rich_text ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhraseRuleRow(row: PhraseRuleRow): PhraseRuleSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    ruleType: row.rule_type,
    phrase: row.phrase,
    rationale: row.rationale,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
