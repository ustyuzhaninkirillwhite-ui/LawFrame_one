import { expect, type APIRequestContext } from "@playwright/test";

interface DeliverySandboxHealthResponse {
  readonly service: string;
  readonly captureCount: number;
  readonly lastCaptureId: string | null;
  readonly lastCaptureAt: string | null;
}

export interface DeliverySandboxCapture {
  readonly id: string;
  readonly receivedAt: string;
  readonly payload: {
    readonly deliveryRequestId: string;
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly subject: string;
    readonly body: string;
    readonly recipientEmails: readonly string[];
    readonly artifactIds: readonly string[];
    readonly metadata: Record<string, unknown>;
  };
}

interface DeliverySandboxCapturesResponse {
  readonly captures: readonly DeliverySandboxCapture[];
}

export function getDeliverySandboxBaseUrl() {
  const raw = process.env.LEXFRAME_DELIVERY_WEBHOOK_URL;

  if (!raw) {
    throw new Error("LEXFRAME_DELIVERY_WEBHOOK_URL is required for delivery sandbox tests.");
  }

  const parsed = new URL(raw);
  return `${parsed.protocol}//${parsed.host}`;
}

export async function resetDeliverySandbox(request: APIRequestContext) {
  const response = await request.post(
    `${getDeliverySandboxBaseUrl()}/captures/reset`,
  );
  expect(response.ok()).toBeTruthy();
}

export async function getDeliverySandboxHealth(
  request: APIRequestContext,
): Promise<DeliverySandboxHealthResponse> {
  const response = await request.get(`${getDeliverySandboxBaseUrl()}/health`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DeliverySandboxHealthResponse;
}

export async function listDeliverySandboxCaptures(
  request: APIRequestContext,
): Promise<readonly DeliverySandboxCapture[]> {
  const response = await request.get(`${getDeliverySandboxBaseUrl()}/captures`);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as DeliverySandboxCapturesResponse;
  return payload.captures;
}
