import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type {
  CanvasDebugError,
  CanvasTestMode,
  CanvasTestRunRequest,
  CanvasTestRunResponse,
  CanvasTestRunStatus,
  CanvasTestRunStepStatus,
  CanvasTestRunStepSummary,
  CanvasTestWarning,
  CanvasValidationSummary,
  ValidationIssue,
} from '@lexframe/contracts';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasDebugRedactionService } from './canvas-debug-redaction.service';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasDryRunPolicyService } from './canvas-dry-run-policy.service';
import { CanvasDataVisibilityService } from './canvas-data-visibility.service';
import { CanvasPinnedDataService } from './canvas-pinned-data.service';
import { CanvasTestExecutor } from './canvas-test-executor.service';
import { CanvasTestPlanner } from './canvas-test-planner.service';
import { CanvasValidationService } from './canvas-validation.service';

interface TestRunRow {
  readonly id: string;
  readonly test_mode: CanvasTestMode;
  readonly status: CanvasTestRunStatus;
  readonly trace_id: string;
  readonly validation_result: CanvasValidationSummary;
  readonly error_code: string | null;
  readonly error_message: string | null;
}

interface TestStepRow {
  readonly node_id: string;
  readonly display_name: string;
  readonly module_code: string | null;
  readonly status: CanvasTestRunStepStatus;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly duration_ms: number | null;
  readonly input_summary: Record<string, unknown> | null;
  readonly output_summary: Record<string, unknown> | null;
  readonly debug_error: CanvasDebugError | null;
}

@Injectable()
export class CanvasTestRunService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly planner: CanvasTestPlanner,
    private readonly executor: CanvasTestExecutor,
    private readonly pinnedDataService: CanvasPinnedDataService,
    private readonly dryRunPolicyService: CanvasDryRunPolicyService,
    private readonly visibilityService: CanvasDataVisibilityService,
    private readonly redactionService: CanvasDebugRedactionService,
    private readonly auditService: AuditService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async start(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: CanvasTestRunRequest,
  ): Promise<CanvasTestRunResponse> {
    this.assertCanRun(access, request.mode);

    const workspaceId = requireWorkspaceId(access);
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    if (request.draft_version_id !== draft.id) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Canvas test request targets a stale draft version.',
      );
    }

    const validation = this.validationService.runtimeGateValidate(
      draft.workflow,
    );
    const pinnedNodeIds = await this.pinnedDataService.listActivePinnedNodeIds({
      actor,
      access,
      automationId,
      draftVersionId: draft.id,
      workflow: draft.workflow,
    });
    const plan = this.planner.buildPlan({
      workflow: draft.workflow,
      validation,
      request,
      pinnedNodeIds,
    });
    const traceId = `canvas-test-${randomUUID()}`;
    const testRunId = await this.createRun({
      actor,
      workspaceId,
      automationId,
      draftVersionId: draft.id,
      request,
      validation,
      traceId,
      usesPinnedData: plan.usesPinnedData,
    });

    await this.recordAudit({
      actor,
      workspaceId,
      automationId,
      action: 'canvas.test_run.created',
      result: 'success',
      traceId,
      metadata: {
        testRunId,
        mode: request.mode,
        targetNodeId: request.target_node_id ?? null,
      },
    });
    await this.emitRunEvent({
      workspaceId,
      testRunId,
      eventType: 'test_run.validating',
      traceId,
      payload: { mode: request.mode },
    });

    const finalStatus = statusForPlan(plan.blocked, request.mode, validation);
    let steps: readonly CanvasTestRunStepSummary[] = [];

    if (request.mode !== 'validation_only' && plan.nodes.length > 0) {
      await this.updateRunStatus(testRunId, 'running');
      await this.emitRunEvent({
        workspaceId,
        testRunId,
        eventType: 'test_run.running',
        traceId,
        payload: { totalSteps: plan.nodes.length },
      });
      steps = await this.executor.execute({
        workspaceId,
        testRunId,
        plan,
        policy: request.policy,
        redaction: request.redaction,
        nodeIssues: buildNodeIssueMap(plan, this.redactionService),
        onStepStarted: async (node) => {
          await this.recordAudit({
            actor,
            workspaceId,
            automationId,
            action: 'canvas.test_run.step_started',
            result: 'success',
            traceId,
            metadata: {
              testRunId,
              nodeId: node.id,
              moduleCode: node.module_code ?? node.block_code,
            },
          });
          await this.emitRunEvent({
            workspaceId,
            testRunId,
            eventType: 'test_run.step_started',
            traceId,
            payload: {
              nodeId: node.id,
              moduleCode: node.module_code ?? node.block_code,
            },
          });
        },
        onStepCompleted: async (step) => {
          await this.recordAudit({
            actor,
            workspaceId,
            automationId,
            action: 'canvas.test_run.step_completed',
            result:
              step.status === 'failed' || step.status === 'blocked_by_policy'
                ? 'error'
                : 'success',
            traceId,
            metadata: {
              testRunId,
              nodeId: step.node_id,
              status: step.status,
              errorCode: step.error?.code ?? null,
            },
          });
          await this.emitRunEvent({
            workspaceId,
            testRunId,
            eventType: 'test_run.step_completed',
            traceId,
            payload: {
              nodeId: step.node_id,
              status: step.status,
              errorCode: step.error?.code ?? null,
            },
          });
        },
      });
    }

    const completedStatus = steps.some(
      (step) => step.status === 'blocked_by_policy',
    )
      ? 'blocked_by_policy'
      : steps.some((step) => step.status === 'failed')
        ? 'failed'
        : finalStatus;

    await this.finishRun({
      testRunId,
      status: completedStatus,
      errorCode: completedStatus === 'failed' ? 'CANVAS_TEST_FAILED' : null,
      errorMessage:
        completedStatus === 'failed'
          ? 'One or more Canvas test steps failed.'
          : null,
    });
    await this.recordAudit({
      actor,
      workspaceId,
      automationId,
      action:
        completedStatus === 'blocked_by_policy'
          ? 'canvas.test_run.policy_blocked'
          : 'canvas.test_run.validated',
      result: completedStatus === 'succeeded' ? 'success' : 'error',
      traceId,
      metadata: {
        testRunId,
        mode: request.mode,
        status: completedStatus,
      },
    });
    await this.emitRunEvent({
      workspaceId,
      testRunId,
      eventType:
        completedStatus === 'blocked_by_policy'
          ? 'test_run.policy_blocked'
          : 'test_run.completed',
      traceId,
      payload: { status: completedStatus },
    });

    return this.getRun(actor, access, automationId, testRunId);
  }

  async getRun(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    testRunId: string,
  ): Promise<CanvasTestRunResponse> {
    this.assertCanViewHistory(access);
    const workspaceId = requireWorkspaceId(access);
    const row = await this.databaseService.one<TestRunRow>(
      `
        select
          id,
          test_mode,
          status,
          trace_id,
          validation_result,
          error_code,
          error_message
        from app.automation_canvas_test_runs
        where workspace_id = $1
          and installed_automation_id = $2
          and id = $3
        limit 1
      `,
      [workspaceId, automationId, testRunId],
    );
    if (!row) {
      throw new AppHttpException(
        'RUN_NOT_FOUND',
        404,
        'Canvas test run was not found.',
      );
    }

    const steps = await this.listSteps(access, automationId, testRunId, actor);
    return {
      test_run_id: row.id,
      status: row.status,
      mode: row.test_mode,
      trace_id: row.trace_id,
      summary: summarizeSteps(steps),
      validation: row.validation_result,
      steps,
      warnings: warningsFromValidation(row.validation_result),
      available_actions: {
        retry: row.status !== 'running',
        pin_outputs: steps.some((step) => step.status === 'succeeded'),
        open_debug: steps.some((step) => step.error),
        create_fixture_from_output: steps.some(
          (step) => step.status === 'succeeded' || step.status === 'simulated',
        ),
        run_dry_run:
          row.test_mode !== 'dry_run_full' &&
          row.validation_result.can_test === true,
      },
    };
  }

  async listSteps(
    access: AccessContext,
    automationId: string,
    testRunId: string,
    actor?: AuthenticatedActor,
  ): Promise<readonly CanvasTestRunStepSummary[]> {
    this.assertCanViewHistory(access);
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<TestStepRow>(
      `
        select
          s.node_id,
          s.display_name,
          s.module_code,
          s.status,
          s.started_at,
          s.finished_at,
          s.duration_ms,
          s.input_summary,
          s.output_summary,
          s.debug_error
        from app.automation_canvas_test_run_steps s
        join app.automation_canvas_test_runs r
          on r.id = s.test_run_id
        where s.workspace_id = $1
          and r.installed_automation_id = $2
          and s.test_run_id = $3
        order by s.position asc, s.started_at asc nulls last
      `,
      [workspaceId, automationId, testRunId],
    );
    const mode = this.visibilityService.resolveMode({
      actor,
      access,
      requested: canViewRaw(access) ? 'raw' : 'redacted',
    });
    return result.rows.map((row) =>
      this.visibilityService.redactTestStep(
        {
          node_id: row.node_id,
          display_name: row.display_name,
          module_code: row.module_code,
          status: row.status,
          input_summary: row.input_summary,
          output_summary: row.output_summary,
          error: row.debug_error,
          timing: row.started_at
            ? {
                started_at: row.started_at,
                finished_at: row.finished_at,
                duration_ms: row.duration_ms,
              }
            : undefined,
        },
        mode,
      ),
    );
  }

  async getStep(
    access: AccessContext,
    automationId: string,
    testRunId: string,
    nodeId: string,
    actor?: AuthenticatedActor,
  ): Promise<CanvasTestRunStepSummary> {
    const step = (
      await this.listSteps(access, automationId, testRunId, actor)
    ).find((item) => item.node_id === nodeId);
    if (!step) {
      throw new AppHttpException(
        'RUN_STEP_NOT_FOUND',
        404,
        'Canvas test step was not found.',
      );
    }
    return step;
  }

  async cancel(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    testRunId: string,
  ): Promise<CanvasTestRunResponse> {
    if (!access.permissions.includes('canvas.test.cancel')) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Canvas test cancel permission is required.',
      );
    }
    await this.finishRun({
      testRunId,
      status: 'cancelled',
      errorCode: null,
      errorMessage: null,
    });
    await this.recordAudit({
      actor,
      workspaceId: requireWorkspaceId(access),
      automationId,
      action: 'canvas.test_run.cancelled',
      result: 'success',
      traceId: null,
      metadata: { testRunId },
    });
    return this.getRun(actor, access, automationId, testRunId);
  }

  compatibilityStepResult(response: CanvasTestRunResponse, nodeId: string) {
    const step = response.steps.find((item) => item.node_id === nodeId);
    return {
      test_run_id: response.test_run_id,
      node_id: nodeId,
      status:
        response.status === 'blocked_by_policy'
          ? 'blocked'
          : step?.status === 'failed'
            ? 'failed'
            : step?.status === 'skipped'
              ? 'skipped'
              : 'passed',
      mode: 'selected_step',
      sample_data_mode: 'auto',
      started_at: step?.timing?.started_at ?? new Date().toISOString(),
      completed_at: step?.timing?.finished_at ?? new Date().toISOString(),
      redacted_output: step?.output_summary ?? null,
      preview: step?.output_summary ?? null,
      issues: response.validation.issues,
      disabled_reason:
        response.status === 'blocked_by_policy'
          ? 'Canvas policy blocked step testing.'
          : undefined,
    } as const;
  }

  buildDefaultRequest(input: {
    readonly draftVersionId: string;
    readonly mode: CanvasTestMode;
    readonly targetNodeId?: string | null;
    readonly targetBranchId?: string | null;
  }): CanvasTestRunRequest {
    return {
      draft_version_id: input.draftVersionId,
      mode: input.mode,
      target_node_id: input.targetNodeId ?? null,
      target_branch_id: input.targetBranchId ?? null,
      input_mode: 'use_current_bindings',
      policy: this.dryRunPolicyService.defaultPolicy(),
      redaction: {
        raw_input_visible: false,
        raw_output_visible: false,
        store_raw_payload: false,
      },
    };
  }

  private assertCanRun(access: AccessContext, mode: CanvasTestMode) {
    const permission = permissionForMode(mode);
    if (!access.permissions.includes(permission)) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        `${permission} permission is required.`,
      );
    }
  }

  private assertCanViewHistory(access: AccessContext) {
    if (!access.permissions.includes('canvas.test.view_history')) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Canvas test history permission is required.',
      );
    }
  }

  private async createRun(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly request: CanvasTestRunRequest;
    readonly validation: CanvasValidationSummary;
    readonly traceId: string;
    readonly usesPinnedData: boolean;
  }) {
    const result = await this.databaseService.one<{ id: string }>(
      `
        insert into app.automation_canvas_test_runs (
          workspace_id,
          installed_automation_id,
          draft_version_id,
          actor_user_id,
          test_mode,
          target_node_id,
          target_branch_id,
          status,
          validation_status,
          validation_result,
          input_fixture_id,
          uses_pinned_data,
          dry_run_policy,
          redaction_policy,
          trace_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'validating',
          $8,
          $9::jsonb,
          $10,
          $11,
          $12::jsonb,
          $13::jsonb,
          $14
        )
        returning id
      `,
      [
        input.workspaceId,
        input.automationId,
        input.draftVersionId,
        input.actor.id,
        input.request.mode,
        input.request.target_node_id ?? null,
        input.request.target_branch_id ?? null,
        input.validation.status,
        JSON.stringify(input.validation),
        input.request.fixture_id ?? null,
        input.usesPinnedData,
        JSON.stringify(input.request.policy),
        JSON.stringify(input.request.redaction),
        input.traceId,
      ],
    );
    if (!result) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        500,
        'Canvas test run was not created.',
      );
    }
    return result.id;
  }

  private async updateRunStatus(
    testRunId: string,
    status: CanvasTestRunStatus,
  ) {
    await this.databaseService.query(
      `
        update app.automation_canvas_test_runs
        set status = $2
        where id = $1
      `,
      [testRunId, status],
    );
  }

  private async finishRun(input: {
    readonly testRunId: string;
    readonly status: CanvasTestRunStatus;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
  }) {
    await this.databaseService.query(
      `
        update app.automation_canvas_test_runs
        set
          status = $2,
          finished_at = timezone('utc', now()),
          duration_ms = greatest(0, floor(extract(epoch from (timezone('utc', now()) - started_at)) * 1000)::int),
          error_code = $3,
          error_message = $4
        where id = $1
      `,
      [input.testRunId, input.status, input.errorCode, input.errorMessage],
    );
  }

  private async recordAudit(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly automationId: string;
    readonly action: string;
    readonly result: 'success' | 'error';
    readonly traceId: string | null;
    readonly metadata: Record<string, unknown>;
  }) {
    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: 'installed_automation',
      entityId: input.automationId,
      result: input.result,
      traceId: input.traceId,
      eventCategory: 'canvas_testing',
      dataClass: 'internal',
      redactionApplied: true,
      metadata: input.metadata,
    });
  }

  private async emitRunEvent(input: {
    readonly workspaceId: string;
    readonly testRunId: string;
    readonly eventType: string;
    readonly traceId: string;
    readonly payload: Record<string, unknown>;
  }) {
    await this.liveEventsService.recordEvent({
      workspaceId: input.workspaceId,
      topics: [`canvas-test-run:${input.testRunId}`],
      eventType: input.eventType,
      entityType: 'canvas_test_run',
      entityId: input.testRunId,
      payload: {
        ...input.payload,
        trace_id: input.traceId,
      },
    });
  }
}

function permissionForMode(mode: CanvasTestMode) {
  switch (mode) {
    case 'validation_only':
      return 'canvas.test.validate' as const;
    case 'test_branch':
      return 'canvas.test.branch' as const;
    case 'test_loop_sample':
      return 'canvas.test.loop' as const;
    case 'dry_run_full':
      return 'canvas.test.dry_run' as const;
    case 'test_selected_step':
    case 'test_until_selected_step':
    case 'test_subworkflow_contract':
    case 'replay_from_previous_run':
      return 'canvas.test.step' as const;
  }
}

function statusForPlan(
  blocked: boolean,
  mode: CanvasTestMode,
  validation: CanvasValidationSummary,
): CanvasTestRunStatus {
  if (blocked) {
    return 'blocked_by_policy';
  }
  if (mode === 'validation_only') {
    return validation.status === 'invalid' ? 'failed' : 'succeeded';
  }
  return 'succeeded';
}

function buildNodeIssueMap(
  plan: { readonly issues: readonly ValidationIssue[] },
  redactionService: CanvasDebugRedactionService,
) {
  const map = new Map<string, CanvasDebugError>();
  for (const issue of plan.issues) {
    if (!issue.affected_node_id || map.has(issue.affected_node_id)) {
      continue;
    }
    map.set(issue.affected_node_id, redactionService.issueToDebugError(issue));
  }
  return map;
}

function summarizeSteps(steps: readonly CanvasTestRunStepSummary[]) {
  return {
    total_steps: steps.length,
    succeeded_steps: steps.filter((step) => step.status === 'succeeded').length,
    failed_steps: steps.filter((step) => step.status === 'failed').length,
    simulated_steps: steps.filter((step) => step.status === 'simulated').length,
    blocked_steps: steps.filter((step) => step.status === 'blocked_by_policy')
      .length,
    redacted_steps: steps.filter(
      (step) =>
        step.status === 'redacted' ||
        Boolean(step.output_summary && step.output_summary.redacted === true),
    ).length,
  };
}

function warningsFromValidation(
  validation: CanvasValidationSummary,
): readonly CanvasTestWarning[] {
  return validation.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      node_id: issue.affected_node_id ?? null,
      severity: issue.severity,
    }));
}

function canViewRaw(access: AccessContext) {
  return access.permissions.includes('canvas.test.view_raw_data');
}
