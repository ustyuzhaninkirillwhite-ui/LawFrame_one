import { AppHttpException } from '../../common/errors/app-http.exception';
import { DeliveryService } from './delivery.service';

describe('DeliveryService', () => {
  const originalEnv = { ...process.env };
  const deliveryRow = {
    id: 'delivery_req_01',
    workspace_id: 'ws_delivery_main',
    workflow_run_id: 'run_delivery_main',
    approval_task_id: null,
    channel: 'email' as const,
    title: 'Delivery title',
    status: 'approved' as const,
    subject: 'Delivery subject',
    body: 'Delivery body',
    body_hash: 'hash_01',
    recipient_emails: ['client@lexframe.local'],
    artifact_ids: ['artifact_01'],
    metadata: {
      source: 'test',
    },
    requires_approval: false,
    approved_at: '2026-04-22T10:00:00.000Z',
    sent_at: null,
    last_error_code: null,
    created_at: '2026-04-22T10:00:00.000Z',
    updated_at: '2026-04-22T10:00:00.000Z',
  };

  type DeliveryServiceInternals = {
    dispatchDeliveryRequest(row: typeof deliveryRow): Promise<{
      provider: string;
      providerMessageId: string | null;
      responsePayload: unknown;
    }>;
  };

  function createService() {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const approvalsService = {
      approveTask: jest.fn(),
    };
    const notificationsService = {
      create: jest.fn(),
    };
    const auditService = {
      record: jest.fn(),
    };
    const liveEventsService = {
      recordEvent: jest.fn(),
    };

    return {
      service: new DeliveryService(
        databaseService as never,
        approvalsService as never,
        notificationsService as never,
        auditService as never,
        liveEventsService as never,
      ),
      databaseService,
      approvalsService,
      notificationsService,
      auditService,
      liveEventsService,
    };
  }

  async function expectAppError(
    promise: Promise<unknown>,
    code: string,
    status: number,
  ) {
    try {
      await promise;
      throw new Error('Expected AppHttpException to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpException);
      expect((error as AppHttpException).code).toBe(code);
      expect((error as AppHttpException).getStatus()).toBe(status);
    }
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('blocks dispatch when delivery transport is disabled', async () => {
    process.env.LEXFRAME_DELIVERY_TRANSPORT = 'disabled';

    const { service } = createService();

    await expectAppError(
      (service as unknown as DeliveryServiceInternals).dispatchDeliveryRequest(
        deliveryRow,
      ),
      'READINESS_GATE_BLOCKED',
      503,
    );
  });

  it('dispatches through the configured webhook transport', async () => {
    process.env.LEXFRAME_DELIVERY_TRANSPORT = 'webhook';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_URL =
      'https://delivery.example.test/send';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN = 'token_123';
    process.env.LEXFRAME_DELIVERY_TIMEOUT_MS = '3000';
    process.env.LEXFRAME_DELIVERY_FROM_EMAIL = 'noreply@example.test';

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          providerMessageId: 'msg_123',
          accepted: true,
        }),
    } as Response);

    const { service } = createService();
    const result = await (
      service as unknown as DeliveryServiceInternals
    ).dispatchDeliveryRequest(deliveryRow);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://delivery.example.test/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.provider).toBe('delivery-webhook');
    expect(result.providerMessageId).toBe('msg_123');
    expect(result.responsePayload).toMatchObject({
      providerMessageId: 'msg_123',
      accepted: true,
    });
  });

  it('reports delivery integration status with sandbox receiver health', async () => {
    process.env.LEXFRAME_DELIVERY_TRANSPORT = 'webhook';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_URL =
      'http://127.0.0.1:8091/hooks/delivery';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN = '';
    process.env.LEXFRAME_DELIVERY_FROM_EMAIL = 'noreply@example.test';

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          service: 'lexframe-delivery-sandbox',
          captureCount: 3,
          lastCaptureId: 'capture_03',
          lastCaptureAt: '2026-04-23T10:00:00.000Z',
        }),
    } as Response);

    const { service } = createService();
    const status = await service.getIntegrationStatus();

    expect(status.transport).toBe('webhook');
    expect(status.canSend).toBe(true);
    expect(status.sandbox).toMatchObject({
      baseUrl: 'http://127.0.0.1:8091',
      healthy: true,
      captureCount: 3,
      lastCaptureId: 'capture_03',
    });
    expect(
      status.dependencies.find((dependency) => dependency.code === 'sandbox-receiver'),
    ).toMatchObject({
      state: 'ready',
    });
  });

  it('sends a synthetic sandbox test and records an audit event', async () => {
    process.env.LEXFRAME_DELIVERY_TRANSPORT = 'webhook';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_URL =
      'http://127.0.0.1:8091/hooks/delivery';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN = 'sandbox_token';
    process.env.LEXFRAME_DELIVERY_TIMEOUT_MS = '3000';
    process.env.LEXFRAME_DELIVERY_FROM_EMAIL = 'noreply@example.test';

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            providerMessageId: 'sandbox_msg_01',
            accepted: true,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            service: 'lexframe-delivery-sandbox',
            captureCount: 4,
            lastCaptureId: 'capture_04',
            lastCaptureAt: '2026-04-23T10:05:00.000Z',
          }),
      } as Response);

    const { service, auditService } = createService();
    const result = await service.runSandboxTest(
      {
        id: 'usr_01',
        email: 'owner@example.test',
      } as never,
      {
        activeWorkspace: {
          id: 'ws_01',
        },
      } as never,
      {
        subject: 'Sandbox smoke',
        recipientEmails: ['sandbox@example.test'],
      },
      {
        requestId: 'req_01',
        traceId: 'trace_01',
      },
    );

    expect(result).toMatchObject({
      status: 'accepted',
      provider: 'delivery-webhook',
      providerMessageId: 'sandbox_msg_01',
      sandbox: {
        healthy: true,
        captureCount: 4,
        lastCaptureId: 'capture_04',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delivery.sandbox.test',
        workspaceId: 'ws_01',
      }),
    );
  });

  it('approves the linked approval task before finalizing the delivery request', async () => {
    const waitingApprovalRow = {
      ...deliveryRow,
      status: 'waiting_approval' as const,
      requires_approval: true,
      approval_task_id: 'approval_task_01',
    };
    const approvedRow = {
      ...waitingApprovalRow,
      status: 'approved' as const,
      approved_at: '2026-04-23T10:10:00.000Z',
    };
    const {
      service,
      databaseService,
      approvalsService,
      notificationsService,
      auditService,
      liveEventsService,
    } = createService();

    databaseService.one
      .mockResolvedValueOnce(waitingApprovalRow)
      .mockResolvedValueOnce(approvedRow);
    databaseService.query.mockResolvedValue({ rows: [] });

    const result = await service.approve(
      {
        id: 'usr_approve_01',
        email: 'owner@example.test',
      } as never,
      {
        activeWorkspace: {
          id: 'ws_delivery_main',
        },
      } as never,
      waitingApprovalRow.id,
      {
        requestId: 'req_approve_01',
        traceId: 'trace_approve_01',
      },
    );

    expect(approvalsService.approveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'usr_approve_01',
      }),
      expect.objectContaining({
        activeWorkspace: expect.objectContaining({
          id: 'ws_delivery_main',
        }),
      }),
      'approval_task_01',
      {},
      {
        requestId: 'req_approve_01',
        traceId: 'trace_approve_01',
      },
    );
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delivery.request.approved',
        entityId: waitingApprovalRow.id,
      }),
    );
    expect(liveEventsService.recordEvent).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('approved');
  });
});
