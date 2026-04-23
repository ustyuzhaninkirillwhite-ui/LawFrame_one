import type {
  DeliveryEventSummary,
  DeliveryIntegrationStatus,
  DeliveryPreview,
  DeliveryRequestDetail,
  DeliveryRequestStatus,
  DeliveryRequestSummary,
  DeliverySandboxReceiverStatus,
  DeliverySandboxTestRequest,
  DeliverySandboxTestResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { type RequestMeta } from '../stage7-support/stage7.helpers';
import { ApprovalsService } from '../approvals/approvals.service';

interface DeliveryRequestRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly workflow_run_id: string;
  readonly approval_task_id: string | null;
  readonly channel: 'email';
  readonly title: string;
  readonly status: DeliveryRequestStatus;
  readonly subject: string;
  readonly body: string;
  readonly body_hash: string;
  readonly recipient_emails: readonly string[] | null;
  readonly artifact_ids: readonly string[] | null;
  readonly metadata: Record<string, unknown> | null;
  readonly requires_approval: boolean;
  readonly approved_at: string | null;
  readonly sent_at: string | null;
  readonly last_error_code: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface DeliveryAttemptRow {
  readonly id: string;
  readonly status: DeliveryRequestDetail['attempts'][number]['status'];
  readonly provider: string;
  readonly attempt_no: number;
  readonly error_code: string | null;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly created_at: string;
}

interface DeliveryEventRow {
  readonly id: string;
  readonly event_type: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
}

interface DeliveryDispatchResult {
  readonly provider: string;
  readonly providerMessageId: string;
  readonly responsePayload: Record<string, unknown>;
  readonly finishedAt: string;
}

interface DeliveryWebhookPayload {
  readonly deliveryRequestId: string;
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly channel: 'email';
  readonly fromEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly recipientEmails: readonly string[];
  readonly artifactIds: readonly string[];
  readonly metadata: Record<string, unknown>;
}

interface DeliverySandboxHealthPayload {
  readonly service?: string;
  readonly captureCount?: number;
  readonly lastCaptureId?: string | null;
  readonly lastCaptureAt?: string | null;
}

@Injectable()
export class DeliveryService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly approvalsService: ApprovalsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async getDetail(
    access: AccessContext,
    deliveryRequestId: string,
  ): Promise<DeliveryRequestDetail> {
    const row = await this.getRow(
      access.activeWorkspace!.id,
      deliveryRequestId,
    );
    return this.buildDetail(row);
  }

  async preview(
    access: AccessContext,
    deliveryRequestId: string,
  ): Promise<DeliveryPreview> {
    const detail = await this.getDetail(access, deliveryRequestId);
    return detail.preview;
  }

  async getIntegrationStatus(): Promise<DeliveryIntegrationStatus> {
    const transport = this.env.LEXFRAME_DELIVERY_TRANSPORT;
    const webhookUrl = this.parseConfiguredWebhookUrl();
    const webhookUrlConfigured = webhookUrl !== null;
    const sandbox = await this.inspectSandboxReceiver(webhookUrl);
    const tokenConfigured =
      this.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN.trim().length > 0;
    const fromEmail = this.env.LEXFRAME_DELIVERY_FROM_EMAIL.trim();
    const dependencies: DeliveryIntegrationStatus['dependencies'] = [
      {
        code: 'transport',
        state: transport === 'webhook' ? 'ready' : 'blocked',
        summary:
          transport === 'webhook'
            ? 'Webhook-транспорт отправки включён.'
            : 'Транспорт отправки отключён.',
      },
      {
        code: 'webhook-url',
        state: webhookUrlConfigured ? 'ready' : 'blocked',
        summary: webhookUrlConfigured
          ? 'Webhook URL для отправки настроен.'
          : 'LEXFRAME_DELIVERY_WEBHOOK_URL не настроен или некорректен.',
      },
      {
        code: 'webhook-token',
        state: 'ready',
        summary: tokenConfigured
          ? 'Bearer-токен webhook отправки настроен.'
          : 'Токен webhook отправки необязателен и сейчас пуст.',
      },
      {
        code: 'from-email',
        state: fromEmail.length > 0 ? 'ready' : 'blocked',
        summary:
          fromEmail.length > 0
            ? 'Адрес отправителя настроен.'
            : 'LEXFRAME_DELIVERY_FROM_EMAIL пуст.',
      },
      {
        code: 'sandbox-receiver',
        state:
          sandbox.baseUrl === null
            ? webhookUrlConfigured
              ? 'degraded'
              : 'blocked'
            : sandbox.healthy
              ? 'ready'
              : 'blocked',
        summary:
          sandbox.baseUrl === null
            ? 'Целевой webhook не является локальным sandbox-приёмником LexFrame.'
            : sandbox.healthy
              ? 'Локальный sandbox-приёмник отправки исправен.'
              : 'Локальный sandbox-приёмник отправки не ответил на health probe.',
        details:
          sandbox.baseUrl !== null
            ? {
                baseUrl: sandbox.baseUrl,
                captureCount: sandbox.captureCount,
                lastCaptureId: sandbox.lastCaptureId,
                lastCaptureAt: sandbox.lastCaptureAt,
              }
            : undefined,
      },
    ];

    return {
      transport,
      canSend:
        transport === 'webhook' &&
        webhookUrlConfigured &&
        fromEmail.length > 0 &&
        (sandbox.baseUrl === null || sandbox.healthy),
      webhookUrlConfigured,
      webhookHost: webhookUrl?.host ?? null,
      webhookPath: webhookUrl?.pathname ?? null,
      fromEmail,
      sandbox,
      dependencies,
    };
  }

  async runSandboxTest(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: DeliverySandboxTestRequest,
    meta: RequestMeta,
  ): Promise<DeliverySandboxTestResponse> {
    const response = await this.dispatchWebhookPayload({
      deliveryRequestId: `sandbox-${randomUUID()}`,
      workspaceId: access.activeWorkspace!.id,
      workflowRunId: `sandbox-run-${randomUUID()}`,
      channel: 'email',
      fromEmail: this.env.LEXFRAME_DELIVERY_FROM_EMAIL,
      subject:
        input.subject?.trim() && input.subject.trim().length > 0
          ? input.subject.trim()
          : 'Тест sandbox-отправки LexFrame Stage 14',
      body:
        input.body?.trim() && input.body.trim().length > 0
          ? input.body.trim()
          : 'Проверочный payload sandbox-отправки из интегрированного runtime Stage 14.',
      recipientEmails:
        input.recipientEmails && input.recipientEmails.length > 0
          ? input.recipientEmails
          : ['sandbox@lexframe.local'],
      artifactIds: [],
      metadata: {
        ...(input.metadata ?? {}),
        source: 'delivery.sandbox.test',
        workspaceId: access.activeWorkspace!.id,
      },
    });
    const sandbox = await this.inspectSandboxReceiver(
      this.parseConfiguredWebhookUrl(),
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'delivery.sandbox.test',
      entityType: 'delivery_integration',
      entityId: access.activeWorkspace!.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        provider: response.provider,
        providerMessageId: response.providerMessageId,
        sandboxBaseUrl: sandbox.baseUrl,
      },
    });

    return {
      status: 'accepted',
      provider: response.provider,
      providerMessageId: response.providerMessageId,
      responsePayload: response.responsePayload,
      sandbox,
    };
  }

  async approve(
    actor: AuthenticatedActor,
    access: AccessContext,
    deliveryRequestId: string,
    meta: RequestMeta,
  ): Promise<DeliveryRequestDetail> {
    const existing = await this.getRow(
      access.activeWorkspace!.id,
      deliveryRequestId,
    );

    if (existing.approval_task_id && existing.status === 'waiting_approval') {
      await this.approvalsService.approveTask(
        actor,
        access,
        existing.approval_task_id,
        {},
        meta,
      );
    }

    const row = await this.databaseService.one<DeliveryRequestRow>(
      `
        update app.delivery_requests
        set
          status = 'approved',
          approved_at = timezone('utc', now()),
          approved_by_user_id = $3,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning
          id,
          workspace_id,
          workflow_run_id,
          approval_task_id,
          channel,
          title,
          status,
          subject,
          body,
          body_hash,
          recipient_emails,
          artifact_ids,
          metadata,
          requires_approval,
          approved_at,
          sent_at,
          last_error_code,
          created_at,
          updated_at
      `,
      [deliveryRequestId, access.activeWorkspace!.id, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'DELIVERY_REQUEST_NOT_FOUND',
        404,
        'Запрос на отправку не найден.',
      );
    }

    await this.recordEvent(
      access.activeWorkspace!.id,
      deliveryRequestId,
      'approved',
      {
        actorUserId: actor.id,
      },
    );

    await this.databaseService.query(
      `
        update app.workflow_runs
        set
          status = 'delivering',
          updated_at = timezone('utc', now()),
          last_transition_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and status = 'waiting_delivery_approval'
      `,
      [row.workflow_run_id, access.activeWorkspace!.id],
    );

    await this.notificationsService.create({
      workspaceId: access.activeWorkspace!.id,
      userId: actor.id,
      type: 'delivery.approved',
      title: 'Доставка подтверждена',
      body: row.title,
      severity: 'success',
      actionUrl: `/runs/${row.workflow_run_id}`,
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      metadata: {
        workflowRunId: row.workflow_run_id,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'delivery.request.approved',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        workflowRunId: row.workflow_run_id,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: row.workflow_run_id,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        `run:${row.workflow_run_id}`,
      ],
      eventType: 'delivery.status.updated',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      payload: {
        deliveryRequest: mapDeliveryRequestRow(row),
      },
    });

    return this.buildDetail(row);
  }

  async send(
    actor: AuthenticatedActor,
    access: AccessContext,
    deliveryRequestId: string,
    meta: RequestMeta,
  ): Promise<DeliveryRequestDetail> {
    const row = await this.getRow(
      access.activeWorkspace!.id,
      deliveryRequestId,
    );

    if (row.requires_approval && row.status !== 'approved') {
      throw new AppHttpException(
        'DELIVERY_APPROVAL_REQUIRED',
        409,
        'Запрос на отправку должен быть согласован перед отправкой.',
      );
    }

    const attemptNoRow = await this.databaseService.one<{
      readonly count: string;
    }>(
      `
        select count(*)::text as count
        from app.delivery_attempts
        where delivery_request_id = $1
      `,
      [deliveryRequestId],
    );
    const attemptNo = Number(attemptNoRow?.count ?? '0') + 1;
    const attemptId = randomUUID();
    const startedAt = new Date().toISOString();

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.delivery_requests
          set
            status = 'sending',
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [deliveryRequestId, access.activeWorkspace!.id],
      );

      await client.query(
        `
          insert into app.delivery_attempts (
            id,
            workspace_id,
            delivery_request_id,
            status,
            provider,
            attempt_no,
            payload,
            response_payload,
            started_at,
            finished_at
          )
          values ($1, $2, $3, 'sending', $4, $5, $6::jsonb, '{}'::jsonb, $7, null)
        `,
        [
          attemptId,
          access.activeWorkspace!.id,
          deliveryRequestId,
          this.resolveTransportProvider(),
          attemptNo,
          JSON.stringify({
            subject: row.subject,
            contentHash: row.body_hash,
            recipientsCount: row.recipient_emails?.length ?? 0,
            recipientEmails: row.recipient_emails ?? [],
            artifactIds: row.artifact_ids ?? [],
          }),
          startedAt,
        ],
      );
    });

    let dispatchResult: DeliveryDispatchResult;

    try {
      dispatchResult = await this.dispatchDeliveryRequest(row);
    } catch (error) {
      await this.failDeliveryAttempt({
        workspaceId: access.activeWorkspace!.id,
        workflowRunId: row.workflow_run_id,
        deliveryRequestId,
        attemptId,
        error,
      });

      await this.recordEvent(
        access.activeWorkspace!.id,
        deliveryRequestId,
        'failed',
        {
          actorUserId: actor.id,
          attemptNo,
          errorCode: classifyDeliveryError(error).errorCode,
        },
      );

      await this.liveEventsService.recordEvent({
        workspaceId: access.activeWorkspace!.id,
        runId: row.workflow_run_id,
        topics: [
          `workspace:${access.activeWorkspace!.id}:dashboard`,
          `run:${row.workflow_run_id}`,
        ],
        eventType: 'delivery.status.updated',
        entityType: 'delivery_request',
        entityId: deliveryRequestId,
        payload: {
          workflowRunId: row.workflow_run_id,
          status: 'failed_retryable',
          attemptNo,
          errorCode: classifyDeliveryError(error).errorCode,
        },
      });

      throw error;
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.delivery_attempts
          set
            status = 'sent',
            provider = $3,
            response_payload = $4::jsonb,
            error_code = null,
            finished_at = $5
          where id = $1
            and workspace_id = $2
        `,
        [
          attemptId,
          access.activeWorkspace!.id,
          dispatchResult.provider,
          JSON.stringify(dispatchResult.responsePayload),
          dispatchResult.finishedAt,
        ],
      );

      await client.query(
        `
          update app.delivery_requests
          set
            status = 'sent',
            sent_at = timezone('utc', now()),
            last_error_code = null,
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [deliveryRequestId, access.activeWorkspace!.id],
      );

      await client.query(
        `
          update app.workflow_runs
          set
            status = 'completed',
            finished_at = coalesce(finished_at, timezone('utc', now())),
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
            and status in ('delivering', 'waiting_delivery_approval', 'running')
        `,
        [row.workflow_run_id, access.activeWorkspace!.id],
      );
    });

    await this.recordEvent(
      access.activeWorkspace!.id,
      deliveryRequestId,
      'sent',
      {
        actorUserId: actor.id,
        attemptNo,
        provider: dispatchResult.provider,
        providerMessageId: dispatchResult.providerMessageId,
      },
    );

    await this.notificationsService.create({
      workspaceId: access.activeWorkspace!.id,
      userId: actor.id,
      type: 'delivery.sent',
      title: 'Результат отправлен',
      body: row.title,
      severity: 'success',
      actionUrl: `/runs/${row.workflow_run_id}`,
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      metadata: {
        workflowRunId: row.workflow_run_id,
        attemptNo,
        provider: dispatchResult.provider,
      },
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'delivery.request.sent',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        workflowRunId: row.workflow_run_id,
        attemptNo,
        recipientsCount: row.recipient_emails?.length ?? 0,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId: row.workflow_run_id,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        `run:${row.workflow_run_id}`,
      ],
      eventType: 'delivery.status.updated',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      payload: {
        workflowRunId: row.workflow_run_id,
        status: 'sent',
        attemptNo,
        provider: dispatchResult.provider,
      },
    });

    return this.getDetail(access, deliveryRequestId);
  }

  async cancel(
    actor: AuthenticatedActor,
    access: AccessContext,
    deliveryRequestId: string,
    meta: RequestMeta,
  ): Promise<DeliveryRequestDetail> {
    const row = await this.databaseService.one<DeliveryRequestRow>(
      `
        update app.delivery_requests
        set
          status = 'cancelled',
          cancelled_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning
          id,
          workspace_id,
          workflow_run_id,
          approval_task_id,
          channel,
          title,
          status,
          subject,
          body,
          body_hash,
          recipient_emails,
          artifact_ids,
          metadata,
          requires_approval,
          approved_at,
          sent_at,
          last_error_code,
          created_at,
          updated_at
      `,
      [deliveryRequestId, access.activeWorkspace!.id],
    );

    if (!row) {
      throw new AppHttpException(
        'DELIVERY_REQUEST_NOT_FOUND',
        404,
        'Запрос на отправку не найден.',
      );
    }

    await this.recordEvent(
      access.activeWorkspace!.id,
      deliveryRequestId,
      'cancelled',
      {
        actorUserId: actor.id,
      },
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'delivery.request.cancelled',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        workflowRunId: row.workflow_run_id,
      },
    });

    return this.buildDetail(row);
  }

  async retry(
    actor: AuthenticatedActor,
    access: AccessContext,
    deliveryRequestId: string,
    meta: RequestMeta,
  ): Promise<DeliveryRequestDetail> {
    const row = await this.getRow(
      access.activeWorkspace!.id,
      deliveryRequestId,
    );
    const nextStatus = row.requires_approval ? 'waiting_approval' : 'approved';

    await this.databaseService.query(
      `
        update app.delivery_requests
        set
          status = $3,
          last_error_code = null,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [deliveryRequestId, access.activeWorkspace!.id, nextStatus],
    );

    await this.recordEvent(
      access.activeWorkspace!.id,
      deliveryRequestId,
      'retry_requested',
      {
        actorUserId: actor.id,
      },
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'delivery.request.retry_requested',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        workflowRunId: row.workflow_run_id,
      },
    });

    return this.getDetail(access, deliveryRequestId);
  }

  async createRuntimeRequest(input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly title: string;
    readonly subject: string;
    readonly body: string;
    readonly recipientEmails: readonly string[];
    readonly artifactIds: readonly string[];
    readonly requiresApproval: boolean;
    readonly metadata?: Record<string, unknown> | null;
    readonly idempotencyKey: string;
  }): Promise<DeliveryRequestDetail> {
    const existing = await this.databaseService.one<DeliveryRequestRow>(
      `
        select
          id,
          workspace_id,
          workflow_run_id,
          approval_task_id,
          channel,
          title,
          status,
          subject,
          body,
          body_hash,
          recipient_emails,
          artifact_ids,
          metadata,
          requires_approval,
          approved_at,
          sent_at,
          last_error_code,
          created_at,
          updated_at
        from app.delivery_requests
        where workflow_run_id = $1
          and workspace_id = $2
          and metadata ->> 'runtimeIdempotencyKey' = $3
        order by created_at desc
        limit 1
      `,
      [input.workflowRunId, input.workspaceId, input.idempotencyKey],
    );

    if (existing) {
      return this.buildDetail(existing);
    }

    const bodyHash = hashContent({
      subject: input.subject,
      body: input.body,
      recipientEmails: input.recipientEmails,
      artifactIds: input.artifactIds,
    });
    const deliveryRequestId = randomUUID();

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.delivery_requests (
            id,
            workspace_id,
            workflow_run_id,
            channel,
            title,
            status,
            subject,
            body,
            body_hash,
            recipient_emails,
            artifact_ids,
            metadata,
            requires_approval
          )
          values (
            $1,
            $2,
            $3,
            'email',
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb,
            $10::jsonb,
            $11::jsonb,
            $12
          )
        `,
        [
          deliveryRequestId,
          input.workspaceId,
          input.workflowRunId,
          input.title,
          input.requiresApproval ? 'waiting_approval' : 'approved',
          input.subject,
          input.body,
          bodyHash,
          JSON.stringify(input.recipientEmails),
          JSON.stringify(input.artifactIds),
          JSON.stringify({
            ...(input.metadata ?? {}),
            runtimeIdempotencyKey: input.idempotencyKey,
          }),
          input.requiresApproval,
        ],
      );

      await client.query(
        `
          update app.workflow_runs
          set
            status = $3,
            finished_at = null,
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [
          input.workflowRunId,
          input.workspaceId,
          input.requiresApproval ? 'waiting_delivery_approval' : 'delivering',
        ],
      );
    });

    await this.recordEvent(input.workspaceId, deliveryRequestId, 'created', {
      contentHash: bodyHash,
      recipientsCount: input.recipientEmails.length,
    });

    if (input.requiresApproval) {
      const task = await this.approvalsService.createRuntimeTask({
        workspaceId: input.workspaceId,
        workflowRunId: input.workflowRunId,
        title: `Согласовать отправку: ${input.title}`,
        kind: 'delivery_approval',
        deliveryRequestId,
        metadata: {
          recipientCount: input.recipientEmails.length,
        },
      });

      await this.databaseService.query(
        `
          update app.delivery_requests
          set approval_task_id = $2, updated_at = timezone('utc', now())
          where id = $1
        `,
        [deliveryRequestId, task.id],
      );
    }

    await this.notificationsService.create({
      workspaceId: input.workspaceId,
      type: 'delivery.created',
      title: 'Подготовлена отправка результата',
      body: input.title,
      severity: 'info',
      actionUrl: `/runs/${input.workflowRunId}`,
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      metadata: {
        workflowRunId: input.workflowRunId,
        recipientsCount: input.recipientEmails.length,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: input.workspaceId,
      runId: input.workflowRunId,
      topics: [
        `workspace:${input.workspaceId}:dashboard`,
        `run:${input.workflowRunId}`,
      ],
      eventType: 'delivery.status.updated',
      entityType: 'delivery_request',
      entityId: deliveryRequestId,
      payload: {
        workflowRunId: input.workflowRunId,
        status: input.requiresApproval ? 'waiting_approval' : 'approved',
        recipientsCount: input.recipientEmails.length,
      },
    });

    const row = await this.getRow(input.workspaceId, deliveryRequestId);
    return this.buildDetail(row);
  }

  private async dispatchDeliveryRequest(
    row: DeliveryRequestRow,
  ): Promise<DeliveryDispatchResult> {
    return this.dispatchWebhookPayload({
      deliveryRequestId: row.id,
      workspaceId: row.workspace_id,
      workflowRunId: row.workflow_run_id,
      channel: row.channel,
      fromEmail: this.env.LEXFRAME_DELIVERY_FROM_EMAIL,
      subject: row.subject,
      body: row.body,
      recipientEmails: row.recipient_emails ?? [],
      artifactIds: row.artifact_ids ?? [],
      metadata: row.metadata ?? {},
    });
  }

  private async dispatchWebhookPayload(
    payload: DeliveryWebhookPayload,
  ): Promise<DeliveryDispatchResult> {
    if (this.env.LEXFRAME_DELIVERY_TRANSPORT !== 'webhook') {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Транспорт отправки отключён.',
        {
          transport: this.env.LEXFRAME_DELIVERY_TRANSPORT,
        },
      );
    }

    if (this.env.LEXFRAME_DELIVERY_WEBHOOK_URL.trim().length === 0) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'LEXFRAME_DELIVERY_WEBHOOK_URL не настроен.',
      );
    }

    const response = await fetch(this.env.LEXFRAME_DELIVERY_WEBHOOK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(this.env.LEXFRAME_DELIVERY_TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        ...(this.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN.trim().length > 0
          ? {
              authorization: `Bearer ${this.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    let responsePayload: Record<string, unknown> = {};

    try {
      responsePayload = (await response.json()) as Record<string, unknown>;
    } catch {
      responsePayload = {};
    }

    if (!response.ok) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        response.status >= 500 ? 503 : 502,
        'Webhook отправки отклонил запрос.',
        {
          status: response.status,
          body: responsePayload,
        },
      );
    }

    const providerMessageId = coerceProviderMessageId(
      responsePayload,
      payload.deliveryRequestId,
    );

    return {
      provider: 'delivery-webhook',
      providerMessageId,
      responsePayload: {
        ...responsePayload,
        providerMessageId,
      },
      finishedAt: new Date().toISOString(),
    };
  }

  private resolveTransportProvider() {
    return this.env.LEXFRAME_DELIVERY_TRANSPORT === 'webhook'
      ? 'delivery-webhook'
      : 'delivery-disabled';
  }

  private async failDeliveryAttempt(input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly deliveryRequestId: string;
    readonly attemptId: string;
    readonly error: unknown;
  }) {
    const failure = classifyDeliveryError(input.error);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.delivery_attempts
          set
            status = $3,
            provider = $4,
            error_code = $5,
            response_payload = $6::jsonb,
            finished_at = $7
          where id = $1
            and workspace_id = $2
        `,
        [
          input.attemptId,
          input.workspaceId,
          failure.status,
          failure.provider,
          failure.errorCode,
          JSON.stringify(failure.responsePayload),
          failure.finishedAt,
        ],
      );

      await client.query(
        `
          update app.delivery_requests
          set
            status = $3,
            last_error_code = $4,
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [
          input.deliveryRequestId,
          input.workspaceId,
          failure.status,
          failure.errorCode,
        ],
      );

      await client.query(
        `
          update app.workflow_runs
          set
            status = 'failed',
            error_code = $3,
            finished_at = timezone('utc', now()),
            updated_at = timezone('utc', now()),
            last_transition_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
            and status in ('delivering', 'waiting_delivery_approval', 'running')
        `,
        [input.workflowRunId, input.workspaceId, failure.errorCode],
      );
    });
  }

  private async getRow(workspaceId: string, deliveryRequestId: string) {
    const row = await this.databaseService.one<DeliveryRequestRow>(
      `
        select
          id,
          workspace_id,
          workflow_run_id,
          approval_task_id,
          channel,
          title,
          status,
          subject,
          body,
          body_hash,
          recipient_emails,
          artifact_ids,
          metadata,
          requires_approval,
          approved_at,
          sent_at,
          last_error_code,
          created_at,
          updated_at
        from app.delivery_requests
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [deliveryRequestId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'DELIVERY_REQUEST_NOT_FOUND',
        404,
        'Запрос на отправку не найден.',
      );
    }

    return row;
  }

  private async buildDetail(
    row: DeliveryRequestRow,
  ): Promise<DeliveryRequestDetail> {
    const [attempts, events] = await Promise.all([
      this.loadAttempts(row.id),
      this.loadEvents(row.id),
    ]);

    return {
      ...mapDeliveryRequestRow(row),
      subject: row.subject,
      body: row.body,
      metadata: row.metadata ?? {},
      preview: {
        channel: row.channel,
        subject: row.subject,
        bodyPreview: row.body.slice(0, 500),
        recipientEmails: row.recipient_emails ?? [],
        attachmentCount: row.artifact_ids?.length ?? 0,
        contentHash: row.body_hash,
        approvalRequired: row.requires_approval,
      },
      attempts,
      events,
    };
  }

  private async loadAttempts(
    deliveryRequestId: string,
  ): Promise<DeliveryRequestDetail['attempts']> {
    const result = await this.databaseService.query<DeliveryAttemptRow>(
      `
        select
          id,
          status,
          provider,
          attempt_no,
          error_code,
          started_at,
          finished_at,
          created_at
        from app.delivery_attempts
        where delivery_request_id = $1
        order by created_at desc
      `,
      [deliveryRequestId],
    );

    return result.rows.map(
      (row): DeliveryRequestDetail['attempts'][number] => ({
        id: row.id,
        status: row.status,
        provider: row.provider,
        attemptNo: row.attempt_no,
        errorCode: row.error_code,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        createdAt: row.created_at,
      }),
    );
  }

  private async loadEvents(
    deliveryRequestId: string,
  ): Promise<readonly DeliveryEventSummary[]> {
    const result = await this.databaseService.query<DeliveryEventRow>(
      `
        select
          id,
          event_type,
          metadata,
          created_at
        from app.delivery_events
        where delivery_request_id = $1
        order by created_at desc
      `,
      [deliveryRequestId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));
  }

  private async recordEvent(
    workspaceId: string,
    deliveryRequestId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ) {
    await this.databaseService.query(
      `
        insert into app.delivery_events (
          id,
          workspace_id,
          delivery_request_id,
          event_type,
          metadata
        )
        values ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        randomUUID(),
        workspaceId,
        deliveryRequestId,
        eventType,
        JSON.stringify(metadata),
      ],
    );
  }

  private parseConfiguredWebhookUrl() {
    const raw = this.env.LEXFRAME_DELIVERY_WEBHOOK_URL.trim();

    if (raw.length === 0) {
      return null;
    }

    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }

  private async inspectSandboxReceiver(
    webhookUrl: URL | null,
  ): Promise<DeliverySandboxReceiverStatus> {
    if (!webhookUrl || webhookUrl.pathname !== '/hooks/delivery') {
      return {
        baseUrl: null,
        healthy: false,
        captureCount: null,
        lastCaptureId: null,
        lastCaptureAt: null,
      };
    }

    const baseUrl = `${webhookUrl.protocol}//${webhookUrl.host}`;

    try {
      const response = await fetch(new URL('/health', baseUrl), {
        method: 'GET',
        signal: AbortSignal.timeout(
          Math.min(this.env.LEXFRAME_DELIVERY_TIMEOUT_MS, 3000),
        ),
      });

      if (!response.ok) {
        return {
          baseUrl,
          healthy: false,
          captureCount: null,
          lastCaptureId: null,
          lastCaptureAt: null,
        };
      }

      const payload = (await response.json()) as DeliverySandboxHealthPayload;

      return {
        baseUrl,
        healthy:
          payload.service === undefined ||
          payload.service === 'lexframe-delivery-sandbox',
        captureCount:
          typeof payload.captureCount === 'number'
            ? payload.captureCount
            : null,
        lastCaptureId:
          typeof payload.lastCaptureId === 'string'
            ? payload.lastCaptureId
            : null,
        lastCaptureAt:
          typeof payload.lastCaptureAt === 'string'
            ? payload.lastCaptureAt
            : null,
      };
    } catch {
      return {
        baseUrl,
        healthy: false,
        captureCount: null,
        lastCaptureId: null,
        lastCaptureAt: null,
      };
    }
  }
}

function mapDeliveryRequestRow(
  row: DeliveryRequestRow,
): DeliveryRequestSummary {
  return {
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
  };
}

function hashContent(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function coerceProviderMessageId(
  payload: Record<string, unknown>,
  fallbackId: string,
) {
  const candidateKeys = [
    'providerMessageId',
    'messageId',
    'id',
    'deliveryId',
  ] as const;

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return `delivery-${fallbackId}`;
}

function classifyDeliveryError(error: unknown) {
  const finishedAt = new Date().toISOString();

  if (error instanceof AppHttpException) {
    const response = error.getResponse();
    return {
      status:
        error.getStatus() >= 500
          ? ('failed_retryable' as const)
          : ('failed_permanent' as const),
      provider: 'delivery-webhook',
      errorCode: error.code,
      responsePayload: {
        message: error.message,
        response,
      },
      finishedAt,
    };
  }

  if (error instanceof Error) {
    return {
      status: 'failed_retryable' as const,
      provider: 'delivery-webhook',
      errorCode: 'READINESS_GATE_BLOCKED',
      responsePayload: {
        message: error.message,
      },
      finishedAt,
    };
  }

  return {
    status: 'failed_retryable' as const,
    provider: 'delivery-webhook',
    errorCode: 'READINESS_GATE_BLOCKED',
    responsePayload: {
      message: 'Неизвестная ошибка транспорта отправки.',
    },
    finishedAt,
  };
}
