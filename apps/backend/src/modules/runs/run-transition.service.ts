import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RunTransitionService {
  constructor(private readonly databaseService: DatabaseService) {}

  async transitionRun(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly status: string;
    readonly currentStep?: string | null;
    readonly progressPercent?: number | null;
    readonly approvalState?: string | null;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly cancellationReason?: string | null;
    readonly finished?: boolean;
  }) {
    await this.databaseService.query(
      `
        update app.workflow_runs
        set
          status = $3,
          current_step = coalesce($4, current_step),
          progress_percent = coalesce($5, progress_percent),
          approval_state = coalesce($6, approval_state),
          error_code = $7,
          error_message = $8,
          cancellation_reason = coalesce($9, cancellation_reason),
          finished_at = case when $10 then timezone('utc', now()) else finished_at end,
          updated_at = timezone('utc', now()),
          last_transition_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [
        input.runId,
        input.workspaceId,
        input.status,
        input.currentStep ?? null,
        input.progressPercent ?? null,
        input.approvalState ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.cancellationReason ?? null,
        input.finished ?? false,
      ],
    );
  }

  async transitionStep(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly stepCode: string;
    readonly status: string;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly incrementAttempts?: boolean;
  }) {
    await this.databaseService.query(
      `
        update app.workflow_run_steps
        set
          status = $4,
          error_code = $5,
          error_message = $6,
          attempt_count = case when $7 then attempt_count + 1 else attempt_count end,
          last_event_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where workflow_run_id = $1
          and workspace_id = $2
          and step_code = $3
      `,
      [
        input.runId,
        input.workspaceId,
        input.stepCode,
        input.status,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.incrementAttempts ?? false,
      ],
    );
  }

  async recordStepEvent(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly stepId?: string | null;
    readonly stepCode: string;
    readonly moduleCode?: string | null;
    readonly eventType: string;
    readonly payload?: Record<string, unknown>;
    readonly errorCode?: string | null;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
  }) {
    await this.databaseService.query(
      `
        insert into app.run_step_events (
          id,
          workflow_run_id,
          workflow_run_step_id,
          workspace_id,
          step_code,
          module_code,
          event_type,
          payload,
          error_code,
          occurred_at,
          idempotency_key
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        on conflict (idempotency_key) do nothing
      `,
      [
        randomUUID(),
        input.runId,
        input.stepId ?? null,
        input.workspaceId,
        input.stepCode,
        input.moduleCode ?? null,
        input.eventType,
        JSON.stringify(input.payload ?? {}),
        input.errorCode ?? null,
        input.occurredAt,
        input.idempotencyKey,
      ],
    );
  }

  async appendArtifactRef(runId: string, artifactId: string) {
    const row = await this.databaseService.one<{
      readonly artifact_refs: readonly string[] | null;
    }>(
      `
        select artifact_refs
        from app.workflow_runs
        where id = $1
        limit 1
      `,
      [runId],
    );
    const nextRefs = [...new Set([...(row?.artifact_refs ?? []), artifactId])];

    await this.databaseService.query(
      `
        update app.workflow_runs
        set
          artifact_refs = $2::jsonb,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [runId, JSON.stringify(nextRefs)],
    );
  }

  async publishOutboxEvent(input: {
    readonly workspaceId: string | null;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly eventName: string;
    readonly payload?: Record<string, unknown>;
  }) {
    await this.databaseService.query(
      `
        insert into app.domain_outbox_events (
          id,
          workspace_id,
          aggregate_type,
          aggregate_id,
          event_name,
          payload
        )
        values ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.aggregateType,
        input.aggregateId,
        input.eventName,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }
}
