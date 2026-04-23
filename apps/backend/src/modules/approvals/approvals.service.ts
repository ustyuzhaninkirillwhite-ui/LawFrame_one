import type {
  ApprovalTaskDetail,
  ApprovalRouteDetail,
  ApprovalRouteStep,
  ApprovalRouteSummary,
  ApprovalTaskRequestChangesRequest,
  ApprovalTaskDecisionRequest,
  ApprovalTaskSummary,
  CreateApprovalRouteRequest,
  UpdateApprovalRouteRequest,
  WorkflowRuntimeApprovalRequestExecuteRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { type RequestMeta } from '../stage7-support/stage7.helpers';

interface ApprovalRouteRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ApprovalRouteSummary['status'];
  readonly applies_to_document_types: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

interface ApprovalRouteStepRow {
  readonly id: string;
  readonly route_id: string;
  readonly step_id: string;
  readonly sort_order: number;
  readonly approver_role: string | null;
  readonly approver_user_id: string | null;
  readonly title: string;
  readonly requires_comment: boolean;
  readonly due_in_hours: number | null;
}

interface ApprovalTaskRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly route_id: string | null;
  readonly generation_job_id: string | null;
  readonly workflow_run_id: string | null;
  readonly title: string;
  readonly status: ApprovalTaskSummary['status'];
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

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async listRoutes(
    access: AccessContext,
  ): Promise<readonly ApprovalRouteSummary[]> {
    const result = await this.databaseService.query<ApprovalRouteRow>(
      `
        select
          id,
          workspace_id,
          name,
          description,
          status,
          applies_to_document_types,
          created_at,
          updated_at
        from app.approval_routes
        where workspace_id = $1
        order by updated_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return Promise.all(result.rows.map((row) => this.buildRoute(row)));
  }

  async getRoute(
    access: AccessContext,
    id: string,
  ): Promise<ApprovalRouteDetail> {
    const row = await this.getRouteRow(id, access.activeWorkspace!.id);
    return this.buildRoute(row);
  }

  async createRoute(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateApprovalRouteRequest,
    meta: RequestMeta,
  ): Promise<ApprovalRouteDetail> {
    const workspaceId = access.activeWorkspace!.id;

    return this.databaseService.transaction(async (client) => {
      const route = await client.query<{ id: string }>(
        `
          insert into app.approval_routes (
            workspace_id,
            name,
            description,
            status,
            applies_to_document_types,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, 'draft', $4::jsonb, $5, $5)
          returning id
        `,
        [
          workspaceId,
          input.name.trim(),
          input.description ?? null,
          JSON.stringify(input.appliesToDocumentTypes ?? []),
          actor.id,
        ],
      );

      await this.replaceRouteSteps(
        client,
        workspaceId,
        route.rows[0]!.id,
        input.steps,
      );

      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'approval.route.created',
        entityType: 'approval_route',
        entityId: route.rows[0]!.id,
        result: 'success',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          stepCount: input.steps.length,
        },
      });

      return this.getRoute(access, route.rows[0]!.id);
    });
  }

  async updateRoute(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: UpdateApprovalRouteRequest,
    meta: RequestMeta,
  ): Promise<ApprovalRouteDetail> {
    const workspaceId = access.activeWorkspace!.id;
    await this.getRoute(access, id);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.approval_routes
          set
            name = coalesce($2, name),
            description = coalesce($3, description),
            status = coalesce($4, status),
            applies_to_document_types = coalesce($5::jsonb, applies_to_document_types),
            updated_by_user_id = $6,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          id,
          input.name?.trim() ?? null,
          input.description ?? null,
          input.status ?? null,
          input.appliesToDocumentTypes
            ? JSON.stringify(input.appliesToDocumentTypes)
            : null,
          actor.id,
        ],
      );

      if (input.steps) {
        await this.replaceRouteSteps(client, workspaceId, id, input.steps);
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'approval.route.updated',
      entityType: 'approval_route',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        hasStepChange: Boolean(input.steps),
      },
    });

    return this.getRoute(access, id);
  }

  async listTasks(
    access: AccessContext,
  ): Promise<readonly ApprovalTaskSummary[]> {
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
        where workspace_id = $1
        order by created_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return result.rows.map(mapTaskRow);
  }

  async getTask(
    access: AccessContext,
    id: string,
  ): Promise<ApprovalTaskDetail> {
    const row = await this.getTaskRow(id, access.activeWorkspace!.id);
    return mapTaskDetailRow(row);
  }

  async approveTask(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: ApprovalTaskDecisionRequest,
    meta: RequestMeta,
  ): Promise<ApprovalTaskSummary> {
    return this.decideTask(actor, access, id, 'approved', input, meta);
  }

  async rejectTask(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: ApprovalTaskDecisionRequest,
    meta: RequestMeta,
  ): Promise<ApprovalTaskSummary> {
    return this.decideTask(actor, access, id, 'rejected', input, meta);
  }

  async executeRuntimeRequest(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: WorkflowRuntimeApprovalRequestExecuteRequest,
    meta: RequestMeta,
  ): Promise<ApprovalTaskSummary> {
    const task = await this.ensureTaskForGeneration({
      actor,
      access,
      generationJobId: input.generationJobId,
      routeId: input.approvalRouteId ?? null,
      workflowRunId: input.workflowRunId,
      title: input.title,
      meta,
    });

    if (!task) {
      throw new AppHttpException(
        'APPROVAL_ROUTE_NOT_FOUND',
        404,
        'Для создания runtime-задачи согласования требуется маршрут согласования.',
      );
    }

    return task;
  }

  async requestChanges(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: ApprovalTaskRequestChangesRequest,
    meta: RequestMeta,
  ): Promise<ApprovalTaskDetail> {
    const row = await this.databaseService.one<ApprovalTaskRow>(
      `
        update app.approval_tasks
        set
          status = 'changes_requested',
          decision_comment = $3,
          requested_changes_count = requested_changes_count + 1,
          decided_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning
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
      `,
      [id, access.activeWorkspace!.id, input.comment ?? null],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_TASK_NOT_FOUND',
        404,
        'Задача согласования не найдена.',
      );
    }

    await this.databaseService.query(
      `
        insert into app.approval_task_events (
          approval_task_id,
          workspace_id,
          event_type,
          actor_user_id,
          comment
        )
        values ($1, $2, 'changes_requested', $3, $4)
      `,
      [id, access.activeWorkspace!.id, actor.id, input.comment ?? null],
    );

    await this.databaseService.query(
      `
        insert into app.approval_decisions (
          id,
          approval_task_id,
          workspace_id,
          workflow_run_id,
          decision,
          comment,
          actor_user_id,
          metadata
        )
        values ($1, $2, $3, $4, 'changes_requested', $5, $6, '{}'::jsonb)
      `,
      [
        randomUUID(),
        id,
        access.activeWorkspace!.id,
        row.workflow_run_id,
        input.comment ?? null,
        actor.id,
      ],
    );

    if (row.workflow_run_id) {
      await this.databaseService.query(
        `
          update app.workflow_runs
          set
            approval_state = 'changes_requested',
            status = case
              when status = 'waiting_delivery_approval' then 'waiting_delivery_approval'
              else 'waiting_approval'
            end,
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
        `,
        [row.workflow_run_id],
      );
    }

    if (row.delivery_request_id) {
      await this.databaseService.query(
        `
          update app.delivery_requests
          set
            status = 'draft',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [row.delivery_request_id],
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'approval.task.changes_requested',
      entityType: 'approval_task',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        workflowRunId: row.workflow_run_id,
        deliveryRequestId: row.delivery_request_id,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: row.workflow_run_id,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        ...(row.workflow_run_id ? [`run:${row.workflow_run_id}`] : []),
      ],
      eventType: 'approval.updated',
      entityType: 'approval_task',
      entityId: id,
      payload: {
        approvalTask: mapTaskDetailRow(row),
      },
    });

    return mapTaskDetailRow(row);
  }

  async createRuntimeTask(input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly title: string;
    readonly kind: ApprovalTaskDetail['kind'];
    readonly routeId?: string | null;
    readonly approverUserId?: string | null;
    readonly approverRole?: string | null;
    readonly deliveryRequestId?: string | null;
    readonly expiresAt?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<ApprovalTaskDetail> {
    let approverUserId = input.approverUserId ?? null;
    let approverRole = input.approverRole ?? null;
    let dueAt: string | null = input.expiresAt ?? null;

    if (input.routeId) {
      const route = await this.getRouteRow(input.routeId, input.workspaceId);
      const steps = await this.loadSteps(route.id);
      const firstStep = steps[0] ?? null;

      if (firstStep) {
        approverUserId = approverUserId ?? firstStep.approverUserId ?? null;
        approverRole = approverRole ?? firstStep.approverRole ?? null;
        if (!dueAt && firstStep.dueInHours) {
          const nextDueAt = new Date();
          nextDueAt.setHours(nextDueAt.getHours() + firstStep.dueInHours);
          dueAt = nextDueAt.toISOString();
        }
      }
    }

    const row = await this.databaseService.one<ApprovalTaskRow>(
      `
        insert into app.approval_tasks (
          id,
          workspace_id,
          route_id,
          workflow_run_id,
          title,
          status,
          approver_user_id,
          approver_role,
          due_at,
          approval_kind,
          delivery_request_id,
          expires_at,
          metadata
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          'pending',
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::jsonb
        )
        returning
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
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.routeId ?? null,
        input.workflowRunId,
        input.title,
        approverUserId,
        approverRole,
        dueAt,
        input.kind,
        input.deliveryRequestId ?? null,
        input.expiresAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_TASK_CREATE_FAILED',
        500,
        'Задача согласования не создана.',
      );
    }

    await this.databaseService.query(
      `
        insert into app.approval_task_events (
          approval_task_id,
          workspace_id,
          event_type,
          actor_user_id,
          comment,
          metadata
        )
        values ($1, $2, 'created', null, null, $3::jsonb)
      `,
      [row.id, input.workspaceId, JSON.stringify(input.metadata ?? {})],
    );

    await this.databaseService.query(
      `
        update app.workflow_runs
        set
          approval_state = 'pending',
          status = case
            when $2 = 'delivery_approval' then 'waiting_delivery_approval'
            else 'waiting_approval'
          end,
          updated_at = timezone('utc', now()),
          last_transition_at = timezone('utc', now())
        where id = $1
      `,
      [input.workflowRunId, input.kind],
    );

    await this.notificationsService.create({
      workspaceId: input.workspaceId,
      userId: row.approver_user_id,
      type: 'approval.created',
      title: row.title,
      body: 'Задача согласования требует рассмотрения.',
      severity: 'warning',
      actionUrl: '/approvals',
      entityType: 'approval_task',
      entityId: row.id,
      metadata: {
        workflowRunId: input.workflowRunId,
        kind: row.approval_kind,
      },
      dedupeKey: `approval:${row.id}:created`,
    });
    await this.liveEventsService.recordEvent({
      workspaceId: input.workspaceId,
      runId: input.workflowRunId,
      topics: [
        `workspace:${input.workspaceId}:dashboard`,
        `run:${input.workflowRunId}`,
      ],
      eventType: 'approval.created',
      entityType: 'approval_task',
      entityId: row.id,
      payload: {
        approvalTask: mapTaskDetailRow(row),
      },
    });

    return mapTaskDetailRow(row);
  }

  async ensureTaskForGeneration(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly generationJobId: string;
    readonly routeId: string | null;
    readonly workflowRunId?: string | null;
    readonly title: string;
    readonly meta: RequestMeta;
  }): Promise<ApprovalTaskSummary | null> {
    if (!input.routeId) {
      return null;
    }

    const existing = await this.databaseService.one<ApprovalTaskRow>(
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
        where generation_job_id = $1
          and route_id = $2
        order by created_at desc
        limit 1
      `,
      [input.generationJobId, input.routeId],
    );

    if (existing) {
      return mapTaskRow(existing);
    }

    const route = await this.getRoute(input.access, input.routeId);
    const firstStep = route.steps[0] ?? null;

    if (!firstStep) {
      throw new AppHttpException(
        'APPROVAL_ROUTE_EMPTY',
        409,
        'В маршруте согласования нет настроенных шагов.',
      );
    }

    const row = await this.databaseService.one<ApprovalTaskRow>(
      `
        insert into app.approval_tasks (
          workspace_id,
          route_id,
          route_step_id,
          generation_job_id,
          workflow_run_id,
          title,
          status,
          approver_user_id,
          approver_role,
          due_at,
          created_by_user_id,
          approval_kind,
          expires_at,
          metadata
        )
        values (
          $1,
          $2,
          (select id from app.approval_route_steps where route_id = $2 and step_id = $3 limit 1),
          $4,
          $5,
          $6,
          'pending',
          $7,
          $8,
          case when $9::integer is null then null else timezone('utc', now()) + make_interval(hours => $9::integer) end,
          $10,
          'document_finalization',
          case when $9::integer is null then null else timezone('utc', now()) + make_interval(hours => $9::integer) end,
          '{}'::jsonb
        )
        returning
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
      `,
      [
        input.access.activeWorkspace!.id,
        input.routeId,
        firstStep.stepId,
        input.generationJobId,
        input.workflowRunId ?? null,
        input.title,
        firstStep.approverUserId ?? null,
        firstStep.approverRole ?? null,
        firstStep.dueInHours ?? null,
        input.actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_TASK_CREATE_FAILED',
        500,
        'Задача согласования не создана.',
      );
    }

    await this.databaseService.query(
      `
        insert into app.approval_task_events (
          approval_task_id,
          workspace_id,
          event_type,
          actor_user_id,
          comment
        )
        values ($1, $2, 'created', $3, $4)
      `,
      [row.id, input.access.activeWorkspace!.id, input.actor.id, null],
    );

    await this.databaseService.query(
      `
        update app.workflow_runs
        set approval_state = 'pending'
        where id = $1
      `,
      [input.workflowRunId ?? null],
    );

    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.access.activeWorkspace!.id,
      action: 'approval.task.created',
      entityType: 'approval_task',
      entityId: row.id,
      result: 'success',
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      metadata: {
        generationJobId: input.generationJobId,
        routeId: input.routeId,
      },
    });

    await this.notificationsService.create({
      workspaceId: input.access.activeWorkspace!.id,
      userId: row.approver_user_id,
      type: 'approval.created',
      title: row.title,
      body: 'Задача согласования требует рассмотрения.',
      severity: 'warning',
      actionUrl: '/approvals',
      entityType: 'approval_task',
      entityId: row.id,
      metadata: {
        generationJobId: input.generationJobId,
        workflowRunId: row.workflow_run_id,
      },
      dedupeKey: `approval:${row.id}:created`,
    });
    await this.liveEventsService.recordEvent({
      workspaceId: input.access.activeWorkspace!.id,
      runId: row.workflow_run_id,
      topics: [
        `workspace:${input.access.activeWorkspace!.id}:dashboard`,
        ...(row.workflow_run_id ? [`run:${row.workflow_run_id}`] : []),
      ],
      eventType: 'approval.created',
      entityType: 'approval_task',
      entityId: row.id,
      payload: {
        approvalTask: mapTaskRow(row),
      },
    });

    return mapTaskRow(row);
  }

  async getLatestDecisionForGeneration(
    generationJobId: string,
  ): Promise<ApprovalTaskSummary | null> {
    const row = await this.databaseService.one<ApprovalTaskRow>(
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
        where generation_job_id = $1
        order by created_at desc
        limit 1
      `,
      [generationJobId],
    );

    return row ? mapTaskRow(row) : null;
  }

  private async decideTask(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    status: ApprovalTaskSummary['status'],
    input: ApprovalTaskDecisionRequest,
    meta: RequestMeta,
  ): Promise<ApprovalTaskSummary> {
    const row = await this.databaseService.one<ApprovalTaskRow>(
      `
        update app.approval_tasks
        set
          status = $2,
          decision_comment = $3,
          decided_at = timezone('utc', now())
        where id = $1
          and workspace_id = $4
        returning
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
      `,
      [id, status, input.comment ?? null, access.activeWorkspace!.id],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_TASK_NOT_FOUND',
        404,
        'Задача согласования не найдена.',
      );
    }

    await this.databaseService.query(
      `
        insert into app.approval_task_events (
          approval_task_id,
          workspace_id,
          event_type,
          actor_user_id,
          comment
        )
        values ($1, $2, $3, $4, $5)
      `,
      [id, access.activeWorkspace!.id, status, actor.id, input.comment ?? null],
    );

    await this.databaseService.query(
      `
        insert into app.approval_decisions (
          id,
          approval_task_id,
          workspace_id,
          workflow_run_id,
          decision,
          comment,
          actor_user_id,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
      `,
      [
        randomUUID(),
        id,
        access.activeWorkspace!.id,
        row.workflow_run_id,
        status,
        input.comment ?? null,
        actor.id,
      ],
    );

    if (row.workflow_run_id) {
      await this.databaseService.query(
        `
          update app.workflow_runs
          set
            approval_state = $2,
            status = case
              when $3 = 'approved' and $4 = 'delivery_approval' then 'waiting_delivery_approval'
              when $3 = 'approved' then 'running'
              when $3 = 'rejected' then 'failed'
              else status
            end,
            error_code = case when $3 = 'rejected' then 'approval_rejected' else error_code end,
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
        `,
        [
          row.workflow_run_id,
          status === 'approved' ? 'approved' : 'rejected',
          status,
          row.approval_kind,
        ],
      );
    }

    if (row.delivery_request_id) {
      await this.databaseService.query(
        `
          update app.delivery_requests
          set
            status = case
              when $2 = 'approved' then 'approved'
              when $2 = 'rejected' then 'cancelled'
              else status
            end,
            approved_at = case when $2 = 'approved' then timezone('utc', now()) else approved_at end,
            approved_by_user_id = case when $2 = 'approved' then $3 else approved_by_user_id end,
            cancelled_at = case when $2 = 'rejected' then timezone('utc', now()) else cancelled_at end,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [row.delivery_request_id, status, actor.id],
      );
    }

    if (row.generation_job_id && status === 'rejected') {
      await this.databaseService.query(
        `
          update app.document_generation_jobs
          set
            status = 'failed',
            error_code = 'approval_rejected',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [row.generation_job_id],
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action:
        status === 'approved'
          ? 'approval.task.approved'
          : 'approval.task.rejected',
      entityType: 'approval_task',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        generationJobId: row.generation_job_id,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: row.workflow_run_id,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        ...(row.workflow_run_id ? [`run:${row.workflow_run_id}`] : []),
      ],
      eventType: 'approval.updated',
      entityType: 'approval_task',
      entityId: id,
      payload: {
        approvalTask: mapTaskRow(row),
      },
    });

    return mapTaskRow(row);
  }

  private async getRouteRow(
    id: string,
    workspaceId: string,
  ): Promise<ApprovalRouteRow> {
    const row = await this.databaseService.one<ApprovalRouteRow>(
      `
        select
          id,
          workspace_id,
          name,
          description,
          status,
          applies_to_document_types,
          created_at,
          updated_at
        from app.approval_routes
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [id, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_ROUTE_NOT_FOUND',
        404,
        'Маршрут согласования не найден.',
      );
    }

    return row;
  }

  private async getTaskRow(
    id: string,
    workspaceId: string,
  ): Promise<ApprovalTaskRow> {
    const row = await this.databaseService.one<ApprovalTaskRow>(
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
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [id, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'APPROVAL_TASK_NOT_FOUND',
        404,
        'Задача согласования не найдена.',
      );
    }

    return row;
  }

  private async loadSteps(
    routeId: string,
  ): Promise<readonly ApprovalRouteStep[]> {
    const result = await this.databaseService.query<ApprovalRouteStepRow>(
      `
        select
          id,
          route_id,
          step_id,
          sort_order,
          approver_role,
          approver_user_id,
          title,
          requires_comment,
          due_in_hours
        from app.approval_route_steps
        where route_id = $1
        order by sort_order asc
      `,
      [routeId],
    );

    return result.rows.map((row) => ({
      stepId: row.step_id,
      order: row.sort_order,
      approverRole: row.approver_role,
      approverUserId: row.approver_user_id,
      title: row.title,
      requiresComment: row.requires_comment,
      dueInHours: row.due_in_hours,
    }));
  }

  private async buildRoute(
    row: ApprovalRouteRow,
  ): Promise<ApprovalRouteDetail> {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      status: row.status,
      appliesToDocumentTypes: row.applies_to_document_types ?? [],
      steps: await this.loadSteps(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async replaceRouteSteps(
    client: { query: DatabaseService['query'] },
    workspaceId: string,
    routeId: string,
    steps: readonly ApprovalRouteStep[],
  ) {
    await client.query(
      `
        delete from app.approval_route_steps
        where route_id = $1
      `,
      [routeId],
    );

    for (const step of steps) {
      await client.query(
        `
          insert into app.approval_route_steps (
            route_id,
            workspace_id,
            step_id,
            sort_order,
            approver_role,
            approver_user_id,
            title,
            requires_comment,
            due_in_hours
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          routeId,
          workspaceId,
          step.stepId,
          step.order,
          step.approverRole ?? null,
          step.approverUserId ?? null,
          step.title,
          step.requiresComment,
          step.dueInHours ?? null,
        ],
      );
    }
  }
}

function mapTaskRow(row: ApprovalTaskRow): ApprovalTaskSummary {
  return {
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
  };
}

function mapTaskDetailRow(row: ApprovalTaskRow): ApprovalTaskDetail {
  return {
    ...mapTaskRow(row),
    kind: row.approval_kind,
    deliveryRequestId: row.delivery_request_id,
    requestedChangesCount: row.requested_changes_count,
    expiresAt: row.expires_at,
    metadata: row.metadata ?? {},
  };
}
