import type {
  ArtifactAcceptAsDocumentResponse,
  ArtifactSignedUrlRequest,
  RunCreateRequest,
  RunCreateResponse,
  SignedUrlResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { randomUUID } from 'node:crypto';
import { ActivepiecesService } from '../activepieces/activepieces.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { type RequestMeta } from '../stage7-support/stage7.helpers';
import { RunErrorClassifierService } from './run-error-classifier.service';
import { RunPreflightService } from './run-preflight.service';
import { RunSnapshotService } from './run-snapshot.service';
import { RunTransitionService } from './run-transition.service';

interface RunInputRow {
  readonly installed_automation_id: string;
  readonly profile_id: string | null;
  readonly input_payload: {
    readonly documentIds?: readonly string[];
    readonly params?: Record<string, unknown>;
  } | null;
}

interface ArtifactLookupRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly artifact_type: string;
  readonly title: string;
  readonly mime_type: string;
  readonly source: ArtifactAcceptAsDocumentResponse['artifact']['source'];
  readonly created_at: string;
}

@Injectable()
export class RunCommandService {
  constructor(
    private readonly activepiecesService: ActivepiecesService,
    private readonly databaseService: DatabaseService,
    private readonly documentsService: DocumentsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly liveEventsService: LiveEventsService,
    private readonly runPreflightService: RunPreflightService,
    private readonly runSnapshotService: RunSnapshotService,
    private readonly runTransitionService: RunTransitionService,
    private readonly runErrorClassifierService: RunErrorClassifierService,
  ) {}

  async createRun(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: RunCreateRequest,
    meta: RequestMeta,
  ): Promise<RunCreateResponse> {
    const preflight = await this.runPreflightService.preflight(
      access,
      automationId,
      input,
    );

    if (!preflight.canStart) {
      throw new AppHttpException(
        'RUN_PREFLIGHT_BLOCKED',
        409,
        'Run preflight reported blocking issues.',
        {
          report: preflight,
        },
      );
    }

    if (input.idempotencyKey) {
      const existing = await this.databaseService.one<{
        readonly id: string;
      }>(
        `
          select id
          from app.workflow_runs
          where workspace_id = $1
            and installed_automation_id = $2
            and idempotency_key = $3
          order by created_at desc
          limit 1
        `,
        [access.activeWorkspace!.id, automationId, input.idempotencyKey],
      );

      if (existing) {
        const snapshot = await this.runSnapshotService.getRunSnapshot(
          access,
          existing.id,
        );

        return {
          runId: snapshot.id,
          status: snapshot.status,
          traceId: snapshot.traceId,
          allowedActions: snapshot.allowedActions,
          runUrl: `/runs/${snapshot.id}`,
        };
      }
    }

    const response = await this.activepiecesService.startRun(
      actor,
      access,
      automationId,
      {
        mode: 'full_run',
        ...(input.inputs ? { inputs: input.inputs } : {}),
        ...(input.profileId !== undefined
          ? { profileId: input.profileId }
          : {}),
        ...(input.idempotencyKey !== undefined
          ? { idempotencyKey: input.idempotencyKey }
          : {}),
      },
      meta,
    );

    await this.databaseService.query(
      `
        insert into app.workflow_run_inputs (
          id,
          workflow_run_id,
          workspace_id,
          profile_id,
          requested_mode,
          input_payload,
          preflight_report,
          idempotency_key,
          requested_by_user_id
        )
        values ($1, $2, $3, $4, 'full_run', $5::jsonb, $6::jsonb, $7, $8)
        on conflict (workflow_run_id) do update
        set
          profile_id = excluded.profile_id,
          input_payload = excluded.input_payload,
          preflight_report = excluded.preflight_report,
          idempotency_key = excluded.idempotency_key,
          requested_by_user_id = excluded.requested_by_user_id
      `,
      [
        randomUUID(),
        response.runId,
        access.activeWorkspace!.id,
        input.profileId ?? null,
        JSON.stringify(input.inputs ?? {}),
        JSON.stringify(preflight),
        input.idempotencyKey ?? null,
        actor.id,
      ],
    );

    await this.runTransitionService.publishOutboxEvent({
      workspaceId: access.activeWorkspace!.id,
      aggregateType: 'workflow_run',
      aggregateId: response.runId,
      eventName: 'workflow.run.started',
      payload: {
        automationId,
        traceId: response.traceId,
      },
    });

    await this.notificationsService.create({
      workspaceId: access.activeWorkspace!.id,
      userId: actor.id,
      type: 'run.started',
      title: 'Запуск сценария создан',
      body: response.runId,
      severity: 'info',
      actionUrl: `/runs/${response.runId}`,
      entityType: 'workflow_run',
      entityId: response.runId,
      metadata: {
        automationId,
        traceId: response.traceId,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'workflow.run.created',
      entityType: 'workflow_run',
      entityId: response.runId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        automationId,
      },
    });

    const snapshot = await this.runSnapshotService.getRunSnapshot(
      access,
      response.runId,
    );
    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: response.runId,
      topics: buildRunTopics(access.activeWorkspace!.id, response.runId),
      eventType: 'run.created',
      entityType: 'workflow_run',
      entityId: response.runId,
      payload: {
        run: snapshot,
      },
    });

    return {
      runId: response.runId,
      status: snapshot.status,
      traceId: response.traceId,
      allowedActions: snapshot.allowedActions,
      runUrl: `/runs/${response.runId}`,
    };
  }

  async cancelRun(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    meta: RequestMeta,
  ) {
    const snapshot = await this.runSnapshotService.getRunSnapshot(
      access,
      runId,
    );

    if (!snapshot.allowedActions.includes('cancel')) {
      throw new AppHttpException(
        'RUN_CANCEL_NOT_ALLOWED',
        409,
        'Current run state cannot be cancelled.',
      );
    }

    await this.runTransitionService.transitionRun({
      workspaceId: access.activeWorkspace!.id,
      runId,
      status: 'cancel_requested',
      cancellationReason: 'user_cancelled',
    });
    await this.runTransitionService.transitionRun({
      workspaceId: access.activeWorkspace!.id,
      runId,
      status: 'cancelled',
      cancellationReason: 'user_cancelled',
      finished: true,
    });

    await this.databaseService.query(
      `
        update app.activepieces_run_bindings
        set
          status = 'cancelled',
          updated_at = timezone('utc', now())
        where workflow_run_id = $1
      `,
      [runId],
    );

    await this.runTransitionService.publishOutboxEvent({
      workspaceId: access.activeWorkspace!.id,
      aggregateType: 'workflow_run',
      aggregateId: runId,
      eventName: 'workflow.run.cancelled',
      payload: {
        actorUserId: actor.id,
      },
    });

    await this.notificationsService.create({
      workspaceId: access.activeWorkspace!.id,
      userId: actor.id,
      type: 'run.cancelled',
      title: 'Запуск отменён',
      body: runId,
      severity: 'warning',
      actionUrl: `/runs/${runId}`,
      entityType: 'workflow_run',
      entityId: runId,
      metadata: {},
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'workflow.run.cancelled',
      entityType: 'workflow_run',
      entityId: runId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {},
    });

    const nextSnapshot = await this.runSnapshotService.getRunSnapshot(
      access,
      runId,
    );
    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId,
      topics: buildRunTopics(access.activeWorkspace!.id, runId),
      eventType: 'run.status.updated',
      entityType: 'workflow_run',
      entityId: runId,
      payload: {
        run: nextSnapshot,
      },
    });

    return nextSnapshot;
  }

  async retryRun(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    meta: RequestMeta,
  ) {
    const original = await this.databaseService.one<RunInputRow>(
      `
        select
          wr.installed_automation_id,
          wri.profile_id,
          wri.input_payload
        from app.workflow_runs wr
        left join app.workflow_run_inputs wri
          on wri.workflow_run_id = wr.id
        where wr.id = $1
          and wr.workspace_id = $2
        limit 1
      `,
      [runId, access.activeWorkspace!.id],
    );

    if (!original) {
      throw new AppHttpException(
        'RUN_NOT_FOUND',
        404,
        'Workflow run was not found.',
      );
    }

    return this.createRun(
      actor,
      access,
      original.installed_automation_id,
      {
        profileId: original.profile_id,
        inputs: original.input_payload ?? undefined,
        idempotencyKey: `${runId}:retry:${Date.now()}`,
      },
      meta,
    );
  }

  async retryStep(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    stepCode: string,
    meta: RequestMeta,
  ) {
    const step = await this.databaseService.one<{
      readonly error_code: string | null;
      readonly error_message: string | null;
    }>(
      `
        select error_code, error_message
        from app.workflow_run_steps
        where workflow_run_id = $1
          and workspace_id = $2
          and step_code = $3
        limit 1
      `,
      [runId, access.activeWorkspace!.id, stepCode],
    );

    if (!step) {
      throw new AppHttpException(
        'RUN_STEP_NOT_FOUND',
        404,
        'Run step was not found.',
      );
    }

    const classified = this.runErrorClassifierService.classify({
      code: step.error_code,
      message: step.error_message,
    });

    await this.runTransitionService.transitionStep({
      workspaceId: access.activeWorkspace!.id,
      runId,
      stepCode,
      status: classified.retryable ? 'pending' : 'pending',
      incrementAttempts: true,
      errorCode: null,
      errorMessage: null,
    });
    await this.runTransitionService.transitionRun({
      workspaceId: access.activeWorkspace!.id,
      runId,
      status: 'retrying',
      currentStep: stepCode,
    });
    await this.runTransitionService.transitionRun({
      workspaceId: access.activeWorkspace!.id,
      runId,
      status: 'running',
      currentStep: stepCode,
    });

    await this.runTransitionService.recordStepEvent({
      workspaceId: access.activeWorkspace!.id,
      runId,
      stepCode,
      eventType: 'retry_requested',
      occurredAt: new Date().toISOString(),
      idempotencyKey: `${runId}:${stepCode}:retry:${Date.now()}`,
      payload: {
        actorUserId: actor.id,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'workflow.run.step.retry_requested',
      entityType: 'workflow_run_step',
      entityId: `${runId}:${stepCode}`,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        runId,
        stepCode,
        retryable: classified.retryable,
      },
    });

    const nextSnapshot = await this.runSnapshotService.getRunSnapshot(
      access,
      runId,
    );
    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId,
      topics: buildRunTopics(access.activeWorkspace!.id, runId),
      eventType: 'run.step.updated',
      entityType: 'workflow_run_step',
      entityId: `${runId}:${stepCode}`,
      payload: {
        runId,
        stepCode,
        run: nextSnapshot,
      },
    });

    return nextSnapshot;
  }

  async createArtifactSignedUrl(
    actor: AuthenticatedActor,
    access: AccessContext,
    artifactId: string,
    input: ArtifactSignedUrlRequest,
    meta: RequestMeta,
  ): Promise<SignedUrlResponse> {
    const artifact = await this.databaseService.one<ArtifactLookupRow>(
      `
        select
          id,
          workflow_run_id,
          document_id,
          document_version_id,
          artifact_type,
          title,
          mime_type,
          source,
          created_at
        from app.run_artifacts
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [artifactId, access.activeWorkspace!.id],
    );

    if (!artifact) {
      throw new AppHttpException(
        'RUN_ARTIFACT_NOT_FOUND',
        404,
        'Run artifact was not found.',
      );
    }

    return this.documentsService.createSignedUrl(
      actor,
      access,
      artifact.document_id,
      input,
      meta,
    );
  }

  async acceptArtifactAsDocument(
    actor: AuthenticatedActor,
    access: AccessContext,
    artifactId: string,
    meta: RequestMeta,
  ): Promise<ArtifactAcceptAsDocumentResponse> {
    const artifact = await this.databaseService.one<ArtifactLookupRow>(
      `
        select
          id,
          workflow_run_id,
          document_id,
          document_version_id,
          artifact_type,
          title,
          mime_type,
          source,
          created_at
        from app.run_artifacts
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [artifactId, access.activeWorkspace!.id],
    );

    if (!artifact) {
      throw new AppHttpException(
        'RUN_ARTIFACT_NOT_FOUND',
        404,
        'Run artifact was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'run.artifact.accepted_as_document',
      entityType: 'run_artifact',
      entityId: artifactId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        runId: artifact.workflow_run_id,
        documentId: artifact.document_id,
      },
    });

    return {
      artifact: {
        id: artifact.id,
        workflowRunId: artifact.workflow_run_id,
        documentId: artifact.document_id,
        documentVersionId: artifact.document_version_id,
        artifactType: artifact.artifact_type,
        title: artifact.title,
        mimeType: artifact.mime_type,
        source: artifact.source,
        createdAt: artifact.created_at,
      },
      documentAccepted: true,
    };
  }
}

function buildRunTopics(workspaceId: string, runId: string) {
  return [`workspace:${workspaceId}:dashboard`, `run:${runId}`];
}
