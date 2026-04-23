import type {
  ApprovalTaskDetail,
  DeliveryRequestSummary,
  RunAllowedAction,
  RunArtifact,
  RunLiveSnapshot,
  RunSnapshot,
  RunStepDetail,
  RunSummary,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { LiveEventsService } from '../realtime/live-events.service';

interface RunRow {
  readonly id: string;
  readonly installed_automation_id: string;
  readonly title: string | null;
  readonly status: RunSnapshot['status'];
  readonly current_step: string;
  readonly progress_percent: number;
  readonly trace_id: string;
  readonly external_run_id: string | null;
  readonly approval_state: RunSnapshot['approvalState'];
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly started_at: string | null;
  readonly finished_at: string | null;
}

interface StepRow {
  readonly id: string;
  readonly step_code: string;
  readonly module_code: string;
  readonly status: RunStepDetail['status'];
  readonly requires_approval: boolean;
  readonly outputs: Record<string, unknown> | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly attempt_count: number;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly last_event_at: string | null;
}

interface ArtifactRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly artifact_type: string;
  readonly title: string;
  readonly mime_type: string;
  readonly source: RunArtifact['source'];
  readonly created_at: string;
}

interface ApprovalTaskRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly route_id: string | null;
  readonly generation_job_id: string | null;
  readonly workflow_run_id: string | null;
  readonly title: string;
  readonly status: ApprovalTaskDetail['status'];
  readonly approver_user_id: string | null;
  readonly approver_role: string | null;
  readonly due_at: string | null;
  readonly decision_comment: string | null;
  readonly created_at: string;
  readonly decided_at: string | null;
  readonly approval_kind: ApprovalTaskDetail['kind'];
  readonly delivery_request_id: string | null;
  readonly requested_changes_count: number;
  readonly expires_at: string | null;
  readonly metadata: Record<string, unknown> | null;
}

interface DeliveryRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly approval_task_id: string | null;
  readonly channel: DeliveryRequestSummary['channel'];
  readonly title: string;
  readonly status: DeliveryRequestSummary['status'];
  readonly recipient_emails: readonly string[] | null;
  readonly artifact_ids: readonly string[] | null;
  readonly body_hash: string;
  readonly requires_approval: boolean;
  readonly approved_at: string | null;
  readonly sent_at: string | null;
  readonly last_error_code: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface RunInputRow {
  readonly profile_id: string | null;
  readonly input_payload: {
    readonly documentIds?: readonly string[];
    readonly params?: Record<string, unknown>;
  } | null;
}

@Injectable()
export class RunSnapshotService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async getRunSnapshot(
    access: AccessContext,
    runId: string,
  ): Promise<RunSnapshot> {
    const run = await this.databaseService.one<RunRow>(
      `
        select
          wr.id,
          wr.installed_automation_id,
          ia.title,
          wr.status,
          wr.current_step,
          wr.progress_percent,
          wr.trace_id,
          wr.external_run_id,
          wr.approval_state,
          wr.error_code,
          wr.error_message,
          wr.started_at,
          wr.finished_at
        from app.workflow_runs wr
        join app.installed_automations ia
          on ia.id = wr.installed_automation_id
        where wr.id = $1
          and wr.workspace_id = $2
        limit 1
      `,
      [runId, access.activeWorkspace!.id],
    );

    if (!run) {
      throw new AppHttpException('RUN_NOT_FOUND', 404, 'Workflow run was not found.');
    }

    const [steps, artifacts, approvalTasks, deliveryRequests, inputs] =
      await Promise.all([
        this.loadSteps(runId, access.activeWorkspace!.id),
        this.loadArtifacts(runId, access.activeWorkspace!.id),
        this.loadApprovalTasks(runId, access.activeWorkspace!.id),
        this.loadDeliveryRequests(runId, access.activeWorkspace!.id),
        this.loadInputs(runId, access.activeWorkspace!.id),
      ]);

    return {
      id: run.id,
      automationId: run.installed_automation_id,
      title: run.title ?? 'Automation run',
      status: run.status,
      traceId: run.trace_id,
      externalRunId: run.external_run_id,
      currentStep: run.current_step,
      progressPercent: run.progress_percent,
      approvalState: run.approval_state,
      errorCode: run.error_code,
      errorMessage: run.error_message,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      allowedActions: computeAllowedActions(run.status, steps, deliveryRequests, artifacts),
      inputs: inputs
        ? {
            profileId: inputs.profile_id,
            documentIds: inputs.input_payload?.documentIds ?? [],
            params: inputs.input_payload?.params ?? {},
          }
        : null,
      steps,
      artifacts,
      approvalTasks,
      deliveryRequests,
    };
  }

  async getRunLiveSnapshot(
    access: AccessContext,
    runId: string,
  ): Promise<RunLiveSnapshot> {
    const snapshot = await this.getRunSnapshot(access, runId);
    const snapshotVersion = await this.liveEventsService.getSnapshotVersion(
      access.activeWorkspace!.id,
      null,
    );

    return {
      ...snapshot,
      snapshotVersion,
      liveTopics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        `run:${runId}`,
      ],
    };
  }

  async listRuns(access: AccessContext): Promise<readonly RunSummary[]> {
    const result = await this.databaseService.query<RunRow>(
      `
        select
          wr.id,
          wr.installed_automation_id,
          ia.title,
          wr.status,
          wr.current_step,
          wr.progress_percent,
          wr.trace_id,
          wr.external_run_id,
          wr.approval_state,
          wr.error_code,
          wr.error_message,
          wr.started_at,
          wr.finished_at
        from app.workflow_runs wr
        join app.installed_automations ia
          on ia.id = wr.installed_automation_id
        where wr.workspace_id = $1
        order by wr.created_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return Promise.all(
      result.rows.map(async (row) => {
        const steps = await this.loadSteps(row.id, access.activeWorkspace!.id);

        return {
          id: row.id,
          automationId: row.installed_automation_id,
          title: row.title ?? 'Automation run',
          status: row.status,
          currentStep: row.current_step,
          progressPercent: row.progress_percent,
          traceId: row.trace_id,
          externalRunId: row.external_run_id,
          stepStatus: steps.map((step) => ({
            stepCode: step.stepCode,
            moduleCode: step.moduleCode,
            status: step.status,
            requiresApproval: step.requiresApproval,
            errorCode: step.errorCode,
          })),
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          errorCode: row.error_code,
          artifactRefs: (await this.loadArtifacts(row.id, access.activeWorkspace!.id)).map(
            (artifact) => artifact.id,
          ),
          approvalState: row.approval_state,
        } satisfies RunSummary;
      }),
    );
  }

  private async loadSteps(runId: string, workspaceId: string) {
    const result = await this.databaseService.query<StepRow>(
      `
        select
          id,
          step_code,
          module_code,
          status,
          requires_approval,
          outputs,
          error_code,
          error_message,
          attempt_count,
          started_at,
          finished_at,
          last_event_at
        from app.workflow_run_steps
        where workflow_run_id = $1
          and workspace_id = $2
        order by position asc
      `,
      [runId, workspaceId],
    );

    return result.rows.map(
      (row): RunStepDetail => ({
        id: row.id,
        stepCode: row.step_code,
        moduleCode: row.module_code,
        status: row.status,
        requiresApproval: row.requires_approval,
        outputs: row.outputs ?? {},
        errorCode: row.error_code,
        errorMessage: row.error_message,
        attemptCount: row.attempt_count,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        lastEventAt: row.last_event_at,
      }),
    );
  }

  private async loadArtifacts(runId: string, workspaceId: string) {
    const result = await this.databaseService.query<ArtifactRow>(
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
        where workflow_run_id = $1
          and workspace_id = $2
        order by created_at desc
      `,
      [runId, workspaceId],
    );

    return result.rows.map(
      (row): RunArtifact => ({
        id: row.id,
        workflowRunId: row.workflow_run_id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        artifactType: row.artifact_type,
        title: row.title,
        mimeType: row.mime_type,
        source: row.source,
        createdAt: row.created_at,
      }),
    );
  }

  private async loadApprovalTasks(runId: string, workspaceId: string) {
    const result = await this.databaseService.query<ApprovalTaskRow>(
      `
        select
          id,
          workspace_id,
          route_id,
          generation_job_id,
          workflow_run_id,
          title,
          status,
          approver_user_id,
          approver_role,
          due_at,
          decision_comment,
          created_at,
          decided_at,
          approval_kind,
          delivery_request_id,
          requested_changes_count,
          expires_at,
          metadata
        from app.approval_tasks
        where workflow_run_id = $1
          and workspace_id = $2
        order by created_at desc
      `,
      [runId, workspaceId],
    );

    return result.rows.map(
      (row): ApprovalTaskDetail => ({
        id: row.id,
        workspaceId: row.workspace_id,
        routeId: row.route_id,
        generationJobId: row.generation_job_id,
        workflowRunId: row.workflow_run_id,
        title: row.title,
        status: row.status,
        approverUserId: row.approver_user_id,
        approverRole: row.approver_role,
        dueAt: row.due_at,
        decisionComment: row.decision_comment,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
        kind: row.approval_kind,
        deliveryRequestId: row.delivery_request_id,
        requestedChangesCount: row.requested_changes_count,
        expiresAt: row.expires_at,
        metadata: row.metadata ?? {},
      }),
    );
  }

  private async loadDeliveryRequests(runId: string, workspaceId: string) {
    const result = await this.databaseService.query<DeliveryRow>(
      `
        select
          id,
          workflow_run_id,
          approval_task_id,
          channel,
          title,
          status,
          recipient_emails,
          artifact_ids,
          body_hash,
          requires_approval,
          approved_at,
          sent_at,
          last_error_code,
          created_at,
          updated_at
        from app.delivery_requests
        where workflow_run_id = $1
          and workspace_id = $2
        order by created_at desc
      `,
      [runId, workspaceId],
    );

    return result.rows.map(
      (row): DeliveryRequestSummary => ({
        id: row.id,
        workflowRunId: row.workflow_run_id,
        approvalTaskId: row.approval_task_id,
        channel: row.channel,
        title: row.title,
        status: row.status,
        recipientEmails: row.recipient_emails ?? [],
        attachmentArtifactIds: row.artifact_ids ?? [],
        contentHash: row.body_hash,
        requiresApproval: row.requires_approval,
        approvedAt: row.approved_at,
        sentAt: row.sent_at,
        lastErrorCode: row.last_error_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  private loadInputs(runId: string, workspaceId: string) {
    return this.databaseService.one<RunInputRow>(
      `
        select
          profile_id,
          input_payload
        from app.workflow_run_inputs
        where workflow_run_id = $1
          and workspace_id = $2
        limit 1
      `,
      [runId, workspaceId],
    );
  }
}

function computeAllowedActions(
  status: RunSnapshot['status'],
  steps: readonly RunStepDetail[],
  deliveryRequests: readonly DeliveryRequestSummary[],
  artifacts: readonly RunArtifact[],
): readonly RunAllowedAction[] {
  const actions = new Set<RunAllowedAction>();

  if (
    [
      'created',
      'ready_to_start',
      'starting',
      'running',
      'waiting_approval',
      'waiting_delivery_approval',
      'delivering',
    ].includes(status)
  ) {
    actions.add('cancel');
  }

  if (
    ['failed', 'cancelled', 'expired', 'completed_with_warnings'].includes(status)
  ) {
    actions.add('retry_run');
  }

  if (
    steps.some((step) =>
      ['failed', 'failed_retryable', 'failed_permanent'].includes(step.status),
    )
  ) {
    actions.add('retry_step');
  }

  if (deliveryRequests.some((item) => item.status === 'waiting_approval')) {
    actions.add('approve_delivery');
  }

  if (deliveryRequests.some((item) => item.status === 'approved')) {
    actions.add('send_delivery');
    actions.add('cancel_delivery');
  }

  if (deliveryRequests.some((item) => item.status === 'failed_retryable')) {
    actions.add('retry_delivery');
  }

  if (artifacts.length > 0) {
    actions.add('open_artifact');
    actions.add('accept_artifact_document');
  }

  return [...actions];
}
