import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import {
  installAndSyncFirstAutomation,
  runDeliveryDemoFlow,
} from "./helpers/activepieces-demo";
import {
  getDeliverySandboxHealth,
  listDeliverySandboxCaptures,
  resetDeliverySandbox,
} from "./helpers/delivery-sandbox";
import { signInAsDemo } from "./helpers/auth";
import { expectReadinessProfile } from "./helpers/readiness";

interface DeliveryIntegrationStatus {
  readonly transport: string;
  readonly canSend: boolean;
  readonly sandbox: {
    readonly healthy: boolean;
    readonly captureCount: number | null;
  };
  readonly dependencies: readonly {
    readonly code: string;
    readonly state: string;
  }[];
}

test.describe("Stage 8 delivery sandbox demo", () => {
  test("local-integrated sends approved delivery payloads into the sandbox receiver", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `delivery-sandbox-${Date.now()}@lexframe.local`,
      fullName: "Stage8 Delivery Sandbox",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    await resetDeliverySandbox(request);
    const session = await getWorkspaceApiSession(page, request);

    const statusResponse = await request.get(
      `${session.apiBaseUrl}/integrations/delivery/status`,
      {
        headers: session.headers,
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    const statusPayload =
      (await statusResponse.json()) as DeliveryIntegrationStatus;
    expect(statusPayload.transport).toBe("webhook");
    expect(statusPayload.canSend).toBeTruthy();
    expect(statusPayload.sandbox.healthy).toBeTruthy();
    expect(
      statusPayload.dependencies.find(
        (dependency) => dependency.code === "sandbox-receiver",
      )?.state,
    ).toBe("ready");

    const automationId = await installAndSyncFirstAutomation(request, session);
    const result = await runDeliveryDemoFlow(request, session, automationId);

    const sandboxHealth = await getDeliverySandboxHealth(request);
    expect(sandboxHealth.captureCount).toBeGreaterThanOrEqual(1);

    const captures = await listDeliverySandboxCaptures(request);
    const matchingCapture = captures.find(
      (capture) =>
        capture.payload.deliveryRequestId === result.sentDelivery.id &&
        capture.payload.workflowRunId === result.smoke.runId,
    );

    expect(matchingCapture).toBeTruthy();
    expect(matchingCapture?.payload.artifactIds).toContain(
      result.smoke.artifactIds[0],
    );
    expect(matchingCapture?.payload.recipientEmails.length).toBeGreaterThan(0);
    expect(result.approvedDelivery.status).toBe("approved");
    expect(result.sentDelivery.attempts[0]?.provider).toBe("delivery-webhook");
    expect(result.finalRun.deliveryRequests[0]?.attachmentArtifactIds).toContain(
      result.smoke.artifactIds[0],
    );
  });
});
