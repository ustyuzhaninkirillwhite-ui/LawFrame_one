import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { runtimeHeaders } from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";

test.describe("@block4 Canvas validation and security", () => {
  test.beforeEach(async ({ page }) => {
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-validation-${Date.now()}@lexframe.local`,
      fullName: "Block4 Validation User",
    });
  });

  test("returns controlled validation outcomes for unsafe canvas operations", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const headers = runtimeHeaders(session);
    const invalidBlock = await request.post(`${session.apiBaseUrl}/canvas/validate-block`, {
      headers,
      data: {
        blockCode: "direct_provider_call",
        targetNodeId: "node_direct_provider",
        config: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          apiKey: "should-not-be-accepted-from-canvas",
        },
        hasApprovalPath: false,
      },
    });
    expect(invalidBlock.status(), await invalidBlock.text()).toBeLessThan(500);
    const blockPayloadText = await invalidBlock.text();
    expect(blockPayloadText).not.toMatch(/stack trace|TypeError|BEGIN PRIVATE KEY|service_role/i);

    const invalidConnection = await request.post(
      `${session.apiBaseUrl}/canvas/validate-connection`,
      {
        headers,
        data: {
          sourceBlockCode: "delivery.email",
          sourceHandle: "main",
          targetBlockCode: "external.runtime",
          targetHandle: "main",
          edgeType: "control",
          hasApprovalPath: false,
        },
      },
    );
    expect(invalidConnection.status(), await invalidConnection.text()).toBeLessThan(500);
    const connectionPayloadText = await invalidConnection.text();
    expect(connectionPayloadText).not.toMatch(/stack trace|TypeError|BEGIN PRIVATE KEY|service_role/i);

    await assertNoAutomationBrowserSecrets(page);
  });
});
