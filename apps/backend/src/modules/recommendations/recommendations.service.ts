import type {
  RecommendationAcceptRequest,
  RecommendationActionResult,
  RecommendationCandidate,
  RecommendationDetail,
  RecommendationDismissRequest,
  RecommendationFeedbackEntry,
  RecommendationFeedbackRequest,
  RecommendationPatternDetail,
  RecommendationPatternSummary,
  RecommendationQualitySnapshot,
  RecommendationSnoozeRequest,
  RecommendationStatus,
  ProcessCaseSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AiPolicyContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestMeta } from '../stage7-support/stage7.helpers';
import { TelemetryService } from '../telemetry/telemetry.service';

interface RecommendationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly pattern_id: string;
  readonly scope: RecommendationCandidate['scope'];
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
  readonly activity_sequence: readonly string[] | null;
  readonly source_events: readonly string[] | null;
  readonly advisory_only: boolean;
  readonly risk_level: RecommendationCandidate['riskLevel'];
  readonly repeat_count: number;
  readonly period_days: number;
  readonly estimated_time_saved_minutes: number;
  readonly explainability_summary: string;
  readonly warnings: readonly string[] | null;
  readonly available_actions: readonly string[] | null;
  readonly workflow_skeleton: Record<string, unknown> | null;
  readonly validation_report: Record<string, unknown> | null;
  readonly policy_report: Record<string, unknown> | null;
  readonly runtime_plan_preview: Record<string, unknown> | null;
  readonly missing_inputs: readonly Record<string, unknown>[] | null;
  readonly source_trace_ids: readonly string[] | null;
  readonly similar_template_ids: readonly string[] | null;
  readonly pattern_summary: Record<string, unknown> | null;
  readonly module_mapping: readonly Record<string, unknown>[] | null;
  readonly status: RecommendationStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly instance_status: RecommendationStatus | null;
  readonly snoozed_until: string | null;
  readonly last_seen_at: string | null;
  readonly accepted_draft_id: string | null;
  readonly notification_id: string | null;
}

interface RecommendationFeedbackRow {
  readonly id: string;
  readonly actor_user_id: string;
  readonly feedback_type: RecommendationFeedbackEntry['feedbackType'];
  readonly note: string | null;
  readonly created_at: string;
}

interface ProcessCaseRow {
  readonly id: string;
  readonly scope: ProcessCaseSummary['scope'];
  readonly pattern_id: string | null;
  readonly case_key: string;
  readonly process_instance_id: string | null;
  readonly session_id: string | null;
  readonly trace_id: string | null;
  readonly run_id: string | null;
  readonly actor_ids: readonly string[] | null;
  readonly activity_sequence: readonly string[] | null;
  readonly event_count: number;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly duration_ms: number | null;
  readonly status: ProcessCaseSummary['status'];
}

interface RecommendationQualityRow {
  readonly captured_at: string;
  readonly metrics: readonly Record<string, unknown>[] | null;
  readonly mining_lag_minutes: number;
  readonly quarantine_rate_percent: number;
  readonly missing_trace_rate_percent: number;
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly aiGatewayService: AIGatewayService,
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async list(
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<readonly RecommendationCandidate[]> {
    try {
      const rows = await this.databaseService.query<RecommendationRow>(
        `
          select
            c.id,
            c.workspace_id,
            c.owner_user_id,
            c.pattern_id,
            c.scope,
            c.title,
            c.summary,
            c.rationale,
            c.activity_sequence,
            c.source_events,
            c.advisory_only,
            c.risk_level,
            c.repeat_count,
            c.period_days,
            c.estimated_time_saved_minutes,
            c.explainability_summary,
            c.warnings,
            c.available_actions,
            c.workflow_skeleton,
            c.validation_report,
            c.policy_report,
            c.runtime_plan_preview,
            c.missing_inputs,
            c.source_trace_ids,
            c.similar_template_ids,
            c.pattern_summary,
            c.module_mapping,
            c.status,
            c.created_at,
            c.updated_at,
            i.status as instance_status,
            i.snoozed_until,
            i.last_seen_at,
            i.accepted_draft_id,
            i.notification_id
          from app.recommendation_candidates c
          left join lateral (
            select
              status,
              snoozed_until,
              last_seen_at,
              accepted_draft_id,
              notification_id
            from app.recommendation_instances
            where candidate_id = c.id
              and (
                (c.scope = 'personal' and owner_user_id = $2)
                or (c.scope = 'team' and owner_user_id is null)
              )
            order by updated_at desc
            limit 1
          ) i on true
          where c.workspace_id = $1
            and (
              (c.scope = 'personal' and c.owner_user_id = $2)
              or (c.scope = 'team' and $3 = true)
            )
          order by coalesce(i.last_seen_at, c.updated_at) desc
        `,
        [
          access.activeWorkspace!.id,
          actor.id,
          access.permissions.includes('recommendation.manage'),
        ],
      );

      return rows.rows.map(mapRecommendationRow);
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return [];
  }

  async getDetail(
    actor: AuthenticatedActor,
    access: AccessContext,
    recommendationId: string,
  ): Promise<RecommendationDetail> {
    try {
      const row = await this.databaseService.one<RecommendationRow>(
        `
          select
            c.id,
            c.workspace_id,
            c.owner_user_id,
            c.pattern_id,
            c.scope,
            c.title,
            c.summary,
            c.rationale,
            c.activity_sequence,
            c.source_events,
            c.advisory_only,
            c.risk_level,
            c.repeat_count,
            c.period_days,
            c.estimated_time_saved_minutes,
            c.explainability_summary,
            c.warnings,
            c.available_actions,
            c.workflow_skeleton,
            c.validation_report,
            c.policy_report,
            c.runtime_plan_preview,
            c.missing_inputs,
            c.source_trace_ids,
            c.similar_template_ids,
            c.pattern_summary,
            c.module_mapping,
            c.status,
            c.created_at,
            c.updated_at,
            i.status as instance_status,
            i.snoozed_until,
            i.last_seen_at,
            i.accepted_draft_id,
            i.notification_id
          from app.recommendation_candidates c
          left join lateral (
            select
              status,
              snoozed_until,
              last_seen_at,
              accepted_draft_id,
              notification_id
            from app.recommendation_instances
            where candidate_id = c.id
              and (
                (c.scope = 'personal' and owner_user_id = $2)
                or (c.scope = 'team' and owner_user_id is null)
              )
            order by updated_at desc
            limit 1
          ) i on true
          where c.id = $1
            and c.workspace_id = $3
            and (
              (c.scope = 'personal' and c.owner_user_id = $2)
              or (c.scope = 'team' and $4 = true)
            )
          limit 1
        `,
        [
          recommendationId,
          actor.id,
          access.activeWorkspace!.id,
          access.permissions.includes('recommendation.manage'),
        ],
      );

      if (row) {
        return this.toDetail(row, recommendationId);
      }
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    throw new AppHttpException(
      'RECOMMENDATION_NOT_FOUND',
      404,
      'Recommendation was not found.',
    );
  }

  async accept(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    recommendationId: string,
    input: RecommendationAcceptRequest,
    meta: RequestMeta,
  ): Promise<RecommendationActionResult> {
    const detail = await this.getDetail(actor, access, recommendationId);
    const workflowSkeleton = {
      ...detail.workflowSkeleton,
      metadata: {
        ...(detail.workflowSkeleton.metadata ?? {}),
        sourceRecommendationId: recommendationId,
      },
    };
    const existingDraftId = await this.loadAcceptedDraftId(
      access.activeWorkspace!.id,
      recommendationId,
      detail.scope,
      actor.id,
    );
    const draft =
      existingDraftId !== null
        ? await this.aiGatewayService.getDraft(access, existingDraftId)
        : await this.aiGatewayService.createDraft(
            actor,
            access,
            policy,
            {
              title: input.draftTitle?.trim() || workflowSkeleton.title,
              workflow: workflowSkeleton,
              source: 'recommendation',
            },
            {
              requestId: meta.requestId,
              traceId: meta.traceId,
              idempotencyKey: input.idempotencyKey ?? null,
            },
          );

    await this.persistInstanceState({
      workspaceId: access.activeWorkspace!.id,
      recommendationId,
      scope: detail.scope,
      actorUserId: actor.id,
      status: 'accepted',
      snoozedUntil: null,
      acceptedDraftId: draft.id,
    });

    const notification = await this.notificationsService.create({
      workspaceId: access.activeWorkspace!.id,
      type: 'recommendation.accepted',
      title: 'Recommendation converted to workflow draft',
      body: detail.title,
      severity: 'success',
      entityType: 'recommendation',
      entityId: recommendationId,
      metadata: {
        draftId: draft.id,
        scope: detail.scope,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'recommendation.accepted',
      entityType: 'recommendation',
      entityId: recommendationId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        draftId: draft.id,
        scope: detail.scope,
        approvalStillRequired:
          detail.policyReport.externalActionsRequireApproval,
      },
    });

    await this.telemetryService.enqueueAuthoritativeEvent({
      actorUserId: actor.id,
      workspaceId: access.activeWorkspace!.id,
      sessionId: null,
      traceId: meta.traceId,
      eventName: 'recommendation.accepted',
      source: 'backend',
      eventTime: new Date().toISOString(),
      resourceType: 'recommendation',
      resourceId: recommendationId,
      properties: {
        recommendationId,
        draftId: draft.id,
        scope: detail.scope,
      },
    });

    return {
      recommendationId,
      status: 'accepted',
      draftId: draft.id,
      workflowDraft: draft,
      notificationId: notification?.id ?? null,
      snoozedUntil: null,
      message:
        'Recommendation was converted into a workflow draft. External delivery remains approval-gated and no runtime sync was triggered.',
    };
  }

  async dismiss(
    actor: AuthenticatedActor,
    access: AccessContext,
    recommendationId: string,
    input: RecommendationDismissRequest,
    meta: RequestMeta,
  ): Promise<RecommendationActionResult> {
    const detail = await this.getDetail(actor, access, recommendationId);

    await this.persistInstanceState({
      workspaceId: access.activeWorkspace!.id,
      recommendationId,
      scope: detail.scope,
      actorUserId: actor.id,
      status: 'dismissed',
      snoozedUntil: null,
      acceptedDraftId: null,
    });

    if (
      input.suppressPattern &&
      access.permissions.includes('recommendation.manage')
    ) {
      await this.persistSuppression({
        workspaceId: access.activeWorkspace!.id,
        recommendationId,
        patternId: detail.pattern.id,
        scope: detail.scope,
        actorUserId: actor.id,
        reasonCode: input.reasonCode ?? 'manual_dismiss',
        note: input.note ?? null,
      });
    }

    await this.persistFeedback({
      workspaceId: access.activeWorkspace!.id,
      recommendationId,
      actorUserId: actor.id,
      feedbackType:
        input.suppressPattern === true ? 'already_covered' : 'not_relevant',
      note: input.note ?? null,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'recommendation.dismissed',
      entityType: 'recommendation',
      entityId: recommendationId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        scope: detail.scope,
        suppressPattern: input.suppressPattern ?? false,
        reasonCode: input.reasonCode ?? null,
      },
    });

    await this.telemetryService.enqueueAuthoritativeEvent({
      actorUserId: actor.id,
      workspaceId: access.activeWorkspace!.id,
      sessionId: null,
      traceId: meta.traceId,
      eventName: 'recommendation.dismissed',
      source: 'backend',
      eventTime: new Date().toISOString(),
      resourceType: 'recommendation',
      resourceId: recommendationId,
      properties: {
        recommendationId,
        scope: detail.scope,
        reasonCode: input.reasonCode ?? null,
      },
    });

    return {
      recommendationId,
      status: 'dismissed',
      draftId: null,
      workflowDraft: null,
      notificationId: null,
      snoozedUntil: null,
      message:
        'Recommendation was dismissed. Candidate state was updated without creating or syncing any automation.',
    };
  }

  async snooze(
    actor: AuthenticatedActor,
    access: AccessContext,
    recommendationId: string,
    input: RecommendationSnoozeRequest,
    meta: RequestMeta,
  ): Promise<RecommendationActionResult> {
    const detail = await this.getDetail(actor, access, recommendationId);
    const snoozedUntil = resolveSnoozeUntil(input);

    await this.persistInstanceState({
      workspaceId: access.activeWorkspace!.id,
      recommendationId,
      scope: detail.scope,
      actorUserId: actor.id,
      status: 'snoozed',
      snoozedUntil,
      acceptedDraftId: null,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'recommendation.snoozed',
      entityType: 'recommendation',
      entityId: recommendationId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        scope: detail.scope,
        snoozedUntil,
      },
    });

    await this.telemetryService.enqueueAuthoritativeEvent({
      actorUserId: actor.id,
      workspaceId: access.activeWorkspace!.id,
      sessionId: null,
      traceId: meta.traceId,
      eventName: 'recommendation.snoozed',
      source: 'backend',
      eventTime: new Date().toISOString(),
      resourceType: 'recommendation',
      resourceId: recommendationId,
      properties: {
        recommendationId,
        scope: detail.scope,
        snoozedUntil,
      },
    });

    return {
      recommendationId,
      status: 'snoozed',
      draftId: null,
      workflowDraft: null,
      notificationId: null,
      snoozedUntil,
      message:
        'Recommendation was snoozed. Realtime delivery is muted until the selected date, but the candidate stays stored.',
    };
  }

  async feedback(
    actor: AuthenticatedActor,
    access: AccessContext,
    recommendationId: string,
    input: RecommendationFeedbackRequest,
    meta: RequestMeta,
  ): Promise<RecommendationActionResult> {
    const detail = await this.getDetail(actor, access, recommendationId);

    await this.persistFeedback({
      workspaceId: access.activeWorkspace!.id,
      recommendationId,
      actorUserId: actor.id,
      feedbackType: input.feedbackType,
      note: input.note ?? null,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'recommendation.feedback_submitted',
      entityType: 'recommendation',
      entityId: recommendationId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        scope: detail.scope,
        feedbackType: input.feedbackType,
      },
    });

    return {
      recommendationId,
      status: detail.status,
      draftId: null,
      workflowDraft: null,
      notificationId: null,
      snoozedUntil: detail.snoozedUntil,
      message:
        'Feedback stored for scoring, suppression and ranking adjustments. No draft or runtime sync was created.',
    };
  }

  async listPatterns(
    access: AccessContext,
  ): Promise<readonly RecommendationPatternSummary[]> {
    try {
      const rows = await this.databaseService.query<RecommendationRow>(
        `
          select
            c.id,
            c.workspace_id,
            c.owner_user_id,
            c.pattern_id,
            c.scope,
            c.title,
            c.summary,
            c.rationale,
            c.activity_sequence,
            c.source_events,
            c.advisory_only,
            c.risk_level,
            c.repeat_count,
            c.period_days,
            c.estimated_time_saved_minutes,
            c.explainability_summary,
            c.warnings,
            c.available_actions,
            c.workflow_skeleton,
            c.validation_report,
            c.policy_report,
            c.runtime_plan_preview,
            c.missing_inputs,
            c.source_trace_ids,
            c.similar_template_ids,
            c.pattern_summary,
            c.module_mapping,
            c.status,
            c.created_at,
            c.updated_at,
            null::text as instance_status,
            null::timestamptz as snoozed_until,
            null::timestamptz as last_seen_at,
            null::uuid as accepted_draft_id,
            null::uuid as notification_id
          from app.recommendation_candidates c
          where c.workspace_id = $1
          order by c.updated_at desc
        `,
        [access.activeWorkspace!.id],
      );

      return rows.rows.map((row) => toPatternSummary(row, row.pattern_summary));
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return [];
  }

  async listProcessCases(
    access: AccessContext,
  ): Promise<readonly ProcessCaseSummary[]> {
    try {
      const rows = await this.databaseService.query<ProcessCaseRow>(
        `
          select
            id,
            scope,
            pattern_id,
            case_key,
            process_instance_id,
            session_id,
            trace_id,
            run_id,
            actor_ids,
            activity_sequence,
            event_count,
            started_at,
            finished_at,
            duration_ms,
            status
          from app.process_case_snapshots
          where workspace_id = $1
          order by started_at desc
        `,
        [access.activeWorkspace!.id],
      );

      return rows.rows.map(mapProcessCaseRow);
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return [];
  }

  async getPatternDetail(
    access: AccessContext,
    patternId: string,
  ): Promise<RecommendationPatternDetail> {
    try {
      const row = await this.databaseService.one<RecommendationRow>(
        `
          select
            c.id,
            c.workspace_id,
            c.owner_user_id,
            c.pattern_id,
            c.scope,
            c.title,
            c.summary,
            c.rationale,
            c.activity_sequence,
            c.source_events,
            c.advisory_only,
            c.risk_level,
            c.repeat_count,
            c.period_days,
            c.estimated_time_saved_minutes,
            c.explainability_summary,
            c.warnings,
            c.available_actions,
            c.workflow_skeleton,
            c.validation_report,
            c.policy_report,
            c.runtime_plan_preview,
            c.missing_inputs,
            c.source_trace_ids,
            c.similar_template_ids,
            c.pattern_summary,
            c.module_mapping,
            c.status,
            c.created_at,
            c.updated_at,
            null::text as instance_status,
            null::timestamptz as snoozed_until,
            null::timestamptz as last_seen_at,
            null::uuid as accepted_draft_id,
            null::uuid as notification_id
          from app.recommendation_candidates c
          where c.workspace_id = $1
            and c.pattern_id = $2
          order by c.updated_at desc
          limit 1
        `,
        [access.activeWorkspace!.id, patternId],
      );

      if (row) {
        const [cases, qualitySnapshot] = await Promise.all([
          this.loadProcessCases(access.activeWorkspace!.id, patternId),
          this.loadQualitySnapshot(access.activeWorkspace!.id),
        ]);

        return {
          ...toPatternSummary(row, row.pattern_summary),
          qualitySnapshot,
          exampleCases: cases,
          moduleMapping:
            (row.module_mapping as unknown as RecommendationPatternDetail['moduleMapping']) ??
            [],
          warnings: row.warnings ?? [],
        };
      }
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    throw new AppHttpException(
      'RECOMMENDATION_NOT_FOUND',
      404,
      'Recommendation pattern was not found.',
    );
  }

  private async toDetail(
    row: RecommendationRow,
    recommendationId: string,
  ): Promise<RecommendationDetail> {
    const feedbackRows = await this.loadFeedback(recommendationId).catch(
      (error: unknown) => handleRecommendationStorageError(error),
    );

    return {
      ...mapRecommendationRow(row),
      pattern: toPatternSummary(row, row.pattern_summary),
      workflowSkeleton: requireRecommendationField<
        RecommendationDetail['workflowSkeleton']
      >(row.workflow_skeleton, 'workflow_skeleton'),
      validationReport: requireRecommendationField<
        RecommendationDetail['validationReport']
      >(row.validation_report, 'validation_report'),
      policyReport: requireRecommendationField<
        RecommendationDetail['policyReport']
      >(row.policy_report, 'policy_report'),
      runtimePlanPreview: requireRecommendationField<
        RecommendationDetail['runtimePlanPreview']
      >(row.runtime_plan_preview, 'runtime_plan_preview'),
      missingInputs:
        (row.missing_inputs as unknown as RecommendationDetail['missingInputs']) ??
        [],
      sourceTraceIds: row.source_trace_ids ?? [],
      similarTemplateIds: row.similar_template_ids ?? [],
      feedbackHistory: (feedbackRows ?? []).map(mapFeedbackRow),
    };
  }

  private async loadFeedback(recommendationId: string) {
    const result = await this.databaseService.query<RecommendationFeedbackRow>(
      `
        select
          id,
          actor_user_id,
          feedback_type,
          note,
          created_at
        from app.recommendation_feedback
        where recommendation_id = $1
        order by created_at desc
      `,
      [recommendationId],
    );

    return result.rows;
  }

  private async loadAcceptedDraftId(
    workspaceId: string,
    recommendationId: string,
    scope: RecommendationCandidate['scope'],
    actorUserId: string,
  ) {
    try {
      const row = await this.databaseService.one<{
        readonly accepted_draft_id: string | null;
      }>(
        `
          select accepted_draft_id
          from app.recommendation_instances
          where candidate_id = $1
            and workspace_id = $2
            and (
              ($3 = 'personal' and owner_user_id = $4)
              or ($3 = 'team' and owner_user_id is null)
            )
          order by updated_at desc
          limit 1
        `,
        [recommendationId, workspaceId, scope, actorUserId],
      );

      return row?.accepted_draft_id ?? null;
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return null;
  }

  private async persistInstanceState(input: {
    readonly workspaceId: string;
    readonly recommendationId: string;
    readonly scope: RecommendationCandidate['scope'];
    readonly actorUserId: string;
    readonly status: RecommendationStatus;
    readonly snoozedUntil: string | null;
    readonly acceptedDraftId: string | null;
  }) {
    try {
      const ownerUserId = input.scope === 'personal' ? input.actorUserId : null;
      const updateResult = await this.databaseService.query(
        `
          update app.recommendation_instances
          set
            status = $4,
            snoozed_until = $5,
            accepted_draft_id = $6,
            accepted_at = case when $4 = 'accepted' then timezone('utc', now()) else accepted_at end,
            dismissed_at = case when $4 = 'dismissed' then timezone('utc', now()) else dismissed_at end,
            last_seen_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
          where candidate_id = $1
            and workspace_id = $2
            and (
              (owner_user_id = $3)
              or (owner_user_id is null and $3 is null)
            )
        `,
        [
          input.recommendationId,
          input.workspaceId,
          ownerUserId,
          input.status,
          input.snoozedUntil,
          input.acceptedDraftId,
        ],
      );

      if ((updateResult.rowCount ?? 0) > 0) {
        return;
      }

      await this.databaseService.query(
        `
          insert into app.recommendation_instances (
            id,
            workspace_id,
            candidate_id,
            owner_user_id,
            scope,
            status,
            snoozed_until,
            accepted_at,
            dismissed_at,
            accepted_draft_id,
            last_seen_at
          )
          values (
            public.app_uuid_v7(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            case when $5 = 'accepted' then timezone('utc', now()) else null end,
            case when $5 = 'dismissed' then timezone('utc', now()) else null end,
            $7,
            timezone('utc', now())
          )
        `,
        [
          input.workspaceId,
          input.recommendationId,
          ownerUserId,
          input.scope,
          input.status,
          input.snoozedUntil,
          input.acceptedDraftId,
        ],
      );
    } catch (error) {
      handleRecommendationStorageError(error);
    }
  }

  private async persistFeedback(input: {
    readonly workspaceId: string;
    readonly recommendationId: string;
    readonly actorUserId: string;
    readonly feedbackType: RecommendationFeedbackEntry['feedbackType'];
    readonly note: string | null;
  }) {
    try {
      await this.databaseService.query(
        `
          insert into app.recommendation_feedback (
            id,
            workspace_id,
            recommendation_id,
            actor_user_id,
            feedback_type,
            note
          )
          values (
            public.app_uuid_v7(),
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
        [
          input.workspaceId,
          input.recommendationId,
          input.actorUserId,
          input.feedbackType,
          input.note,
        ],
      );
    } catch (error) {
      handleRecommendationStorageError(error);
    }
  }

  private async persistSuppression(input: {
    readonly workspaceId: string;
    readonly recommendationId: string;
    readonly patternId: string;
    readonly scope: RecommendationCandidate['scope'];
    readonly actorUserId: string;
    readonly reasonCode: string;
    readonly note: string | null;
  }) {
    try {
      await this.databaseService.query(
        `
          insert into app.recommendation_suppressions (
            id,
            workspace_id,
            recommendation_id,
            pattern_id,
            scope,
            suppressed_by_user_id,
            reason_code,
            note
          )
          values (
            public.app_uuid_v7(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
        `,
        [
          input.workspaceId,
          input.recommendationId,
          input.patternId,
          input.scope,
          input.actorUserId,
          input.reasonCode,
          input.note,
        ],
      );
    } catch (error) {
      handleRecommendationStorageError(error);
    }
  }

  private async loadProcessCases(workspaceId: string, patternId: string) {
    try {
      const rows = await this.databaseService.query<ProcessCaseRow>(
        `
          select
            id,
            scope,
            pattern_id,
            case_key,
            process_instance_id,
            session_id,
            trace_id,
            run_id,
            actor_ids,
            activity_sequence,
            event_count,
            started_at,
            finished_at,
            duration_ms,
            status
          from app.process_case_snapshots
          where workspace_id = $1
            and pattern_id = $2
          order by started_at desc
          limit 20
        `,
        [workspaceId, patternId],
      );

      return rows.rows.map(mapProcessCaseRow);
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return [];
  }

  private async loadQualitySnapshot(workspaceId: string) {
    try {
      const row = await this.databaseService.one<RecommendationQualityRow>(
        `
          select
            captured_at,
            metrics,
            mining_lag_minutes,
            quarantine_rate_percent,
            missing_trace_rate_percent
          from app.recommendation_quality_snapshots
          where workspace_id = $1
          order by captured_at desc
          limit 1
        `,
        [workspaceId],
      );

      if (row) {
        return {
          capturedAt: row.captured_at,
          metrics:
            (row.metrics as unknown as RecommendationQualitySnapshot['metrics']) ??
            [],
          miningLagMinutes: row.mining_lag_minutes,
          quarantineRatePercent: row.quarantine_rate_percent,
          missingTraceRatePercent: row.missing_trace_rate_percent,
        } satisfies RecommendationQualitySnapshot;
      }
    } catch (error) {
      handleRecommendationStorageError(error);
    }

    return {
      capturedAt: new Date().toISOString(),
      metrics: [],
      miningLagMinutes: 0,
      quarantineRatePercent: 0,
      missingTraceRatePercent: 0,
    };
  }
}

function mapRecommendationRow(row: RecommendationRow): RecommendationCandidate {
  return {
    id: row.id,
    patternId: row.pattern_id,
    scope: row.scope,
    title: row.title,
    summary: row.summary,
    rationale: row.rationale,
    activitySequence: row.activity_sequence ?? [],
    sourceEvents: row.source_events ?? [],
    advisoryOnly: true,
    riskLevel: row.risk_level,
    repeatCount: row.repeat_count,
    periodDays: row.period_days,
    estimatedTimeSavedMinutes: row.estimated_time_saved_minutes,
    explainabilitySummary: row.explainability_summary,
    warnings: row.warnings ?? [],
    availableActions:
      (row.available_actions as RecommendationCandidate['availableActions']) ??
      [],
    status: row.instance_status ?? row.status,
    snoozedUntil: row.snoozed_until,
    lastSeenAt: row.last_seen_at ?? row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPatternSummary(
  row: RecommendationRow,
  patternSummary: Record<string, unknown> | null,
): RecommendationPatternSummary {
  if (patternSummary) {
    return patternSummary as unknown as RecommendationPatternSummary;
  }

  return {
    id: row.pattern_id,
    scope: row.scope,
    title: row.title,
    strategy: 'n_gram',
    activitySequence: row.activity_sequence ?? [],
    caseCount: row.repeat_count,
    distinctUserCount: row.scope === 'team' ? 3 : 1,
    repeatCount: row.repeat_count,
    periodDays: row.period_days,
    riskLevel: row.risk_level,
    explainabilitySummary: row.explainability_summary,
    overlapStatus: 'none',
    status: row.status === 'dismissed' ? 'suppressed' : 'candidate',
    lastSeenAt: row.last_seen_at ?? row.updated_at,
  };
}

function mapFeedbackRow(
  row: RecommendationFeedbackRow,
): RecommendationFeedbackEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    feedbackType: row.feedback_type,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapProcessCaseRow(row: ProcessCaseRow): ProcessCaseSummary {
  return {
    id: row.id,
    scope: row.scope,
    caseKey: row.case_key,
    processInstanceId: row.process_instance_id,
    sessionId: row.session_id,
    traceId: row.trace_id,
    runId: row.run_id,
    actorIds: row.actor_ids ?? [],
    activitySequence: row.activity_sequence ?? [],
    eventCount: row.event_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    status: row.status,
  };
}

function resolveSnoozeUntil(input: RecommendationSnoozeRequest) {
  if (input.until && input.until.trim().length > 0) {
    return input.until;
  }

  const days = input.days && input.days > 0 ? input.days : 7;
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + days);
  return target.toISOString();
}

function isMissingRelationError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: string }).code === '42P01'
  );
}

function handleRecommendationStorageError(error: unknown): never {
  if (isMissingRelationError(error)) {
    throw new AppHttpException(
      'READINESS_GATE_BLOCKED',
      503,
      'Recommendation analytics tables are not ready.',
      {
        hint: 'Apply stage9 migrations and run event ingestion / quality snapshot jobs.',
      },
    );
  }

  throw error;
}

function requireRecommendationField<T>(value: unknown, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new AppHttpException(
      'READINESS_GATE_BLOCKED',
      503,
      `Recommendation payload field ${fieldName} is not ready.`,
      {
        field: fieldName,
      },
    );
  }

  return value as T;
}
