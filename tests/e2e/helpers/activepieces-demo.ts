import { expect, type APIRequestContext } from "@playwright/test";
import type { WorkspaceApiSession } from "./api";

interface LibraryTemplateSummary {
  readonly id: string;
}

interface InstalledAutomationDetail {
  readonly id: string;
}

interface SyncAutomationRuntimeResponse {
  readonly status: "synced" | "noop" | "failed";
}

export interface ActivepiecesRunSmokeResponse {
  readonly status: string;
  readonly runId: string;
  readonly externalRunId: string | null;
  readonly artifactIds: readonly string[];
  readonly callbackReceiptSummary: {
    readonly received: number;
    readonly processed: number;
    readonly types: readonly string[];
  };
}

export interface RunSnapshotResponse {
  readonly id: string;
  readonly status: string;
  readonly artifacts: readonly {
    readonly id: string;
  }[];
  readonly deliveryRequests: readonly {
    readonly id: string;
    readonly status: string;
    readonly approvalTaskId: string | null;
    readonly attachmentArtifactIds: readonly string[];
  }[];
}

export interface DeliveryRequestDetailResponse {
  readonly id: string;
  readonly status: string;
  readonly attempts: readonly {
    readonly id: string;
    readonly status: string;
    readonly provider: string;
  }[];
  readonly recipientEmails: readonly string[];
  readonly attachmentArtifactIds: readonly string[];
}

export interface DeliveryDemoFlowResult {
  readonly automationId: string;
  readonly smoke: ActivepiecesRunSmokeResponse;
  readonly initialRun: RunSnapshotResponse;
  readonly approvedDelivery: DeliveryRequestDetailResponse;
  readonly sentDelivery: DeliveryRequestDetailResponse;
  readonly finalRun: RunSnapshotResponse;
}

export function buildJsonHeaders(session: WorkspaceApiSession) {
  return {
    ...session.headers,
    "content-type": "application/json",
  };
}

export async function installAndSyncFirstAutomation(
  request: APIRequestContext,
  session: WorkspaceApiSession,
) {
  const jsonHeaders = buildJsonHeaders(session);
  const libraryResponse = await request.get(`${session.apiBaseUrl}/library`, {
    headers: session.headers,
  });
  expect(libraryResponse.ok()).toBeTruthy();

  const library =
    (await libraryResponse.json()) as readonly LibraryTemplateSummary[];
  expect(library.length).toBeGreaterThan(0);

  const installResponse = await request.post(
    `${session.apiBaseUrl}/automation-templates/${library[0]!.id}/install`,
    {
      headers: jsonHeaders,
      data: {},
    },
  );
  expect(installResponse.ok()).toBeTruthy();

  const installed =
    (await installResponse.json()) as InstalledAutomationDetail;

  const syncResponse = await request.post(
    `${session.apiBaseUrl}/automations/${installed.id}/runtime/sync`,
    {
      headers: jsonHeaders,
      data: {},
    },
  );
  const syncText = await syncResponse.text();
  expect(syncResponse.ok(), syncText).toBeTruthy();
  const syncPayload =
    JSON.parse(syncText) as SyncAutomationRuntimeResponse;
  expect(syncPayload.status).toBe("synced");

  return installed.id;
}

export async function runDeliveryDemoFlow(
  request: APIRequestContext,
  session: WorkspaceApiSession,
  automationId: string,
): Promise<DeliveryDemoFlowResult> {
  const jsonHeaders = buildJsonHeaders(session);
  const smokeResponse = await request.post(
    `${session.apiBaseUrl}/activepieces/run-smoke`,
    {
      headers: jsonHeaders,
      data: {
        automationId,
        mode: "full_run",
      },
    },
  );
  expect(smokeResponse.ok()).toBeTruthy();
  const smokePayload =
    (await smokeResponse.json()) as ActivepiecesRunSmokeResponse;
  expect(smokePayload.status).toBe("waiting_delivery_approval");
  expect(smokePayload.runId).toBeTruthy();
  expect(smokePayload.externalRunId).toBeTruthy();
  expect(smokePayload.artifactIds.length).toBeGreaterThan(0);
  expect(smokePayload.callbackReceiptSummary.types).toContain("artifact");
  expect(smokePayload.callbackReceiptSummary.types).toContain("delivery_gate");

  const runResponse = await request.get(
    `${session.apiBaseUrl}/runs/${smokePayload.runId}`,
    {
      headers: session.headers,
    },
  );
  expect(runResponse.ok()).toBeTruthy();
  const initialRun = (await runResponse.json()) as RunSnapshotResponse;
  expect(initialRun.status).toBe("waiting_delivery_approval");
  expect(initialRun.artifacts.length).toBeGreaterThan(0);
  expect(initialRun.deliveryRequests.length).toBeGreaterThan(0);

  const deliveryRequest = initialRun.deliveryRequests[0]!;
  expect(deliveryRequest.status).toBe("waiting_approval");

  const approveResponse = await request.post(
    `${session.apiBaseUrl}/delivery-requests/${deliveryRequest.id}/approve`,
    {
      headers: jsonHeaders,
      data: {},
    },
  );
  expect(approveResponse.ok()).toBeTruthy();
  const approvedDelivery =
    (await approveResponse.json()) as DeliveryRequestDetailResponse;
  expect(approvedDelivery.status).toBe("approved");

  const sendResponse = await request.post(
    `${session.apiBaseUrl}/delivery-requests/${deliveryRequest.id}/send`,
    {
      headers: jsonHeaders,
      data: {},
    },
  );
  expect(sendResponse.ok()).toBeTruthy();
  const sentDelivery =
    (await sendResponse.json()) as DeliveryRequestDetailResponse;
  expect(sentDelivery.status).toBe("sent");
  expect(sentDelivery.attempts.length).toBeGreaterThan(0);

  const finalRunResponse = await request.get(
    `${session.apiBaseUrl}/runs/${smokePayload.runId}`,
    {
      headers: session.headers,
    },
  );
  expect(finalRunResponse.ok()).toBeTruthy();
  const finalRun = (await finalRunResponse.json()) as RunSnapshotResponse;
  expect(finalRun.status).toBe("completed");
  expect(finalRun.deliveryRequests[0]?.status).toBe("sent");

  return {
    automationId,
    smoke: smokePayload,
    initialRun,
    approvedDelivery,
    sentDelivery,
    finalRun,
  };
}
