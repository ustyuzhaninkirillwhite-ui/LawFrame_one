import { expect, test, type Response } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertTokensClearedAfterLeavingAutomationFamily,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas, runtimeHeaders } from "./utils/automation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation session refresh and expiry", () => {
  test("session refresh/reload stays backend-mediated and does not storm", async ({
    page,
    request,
  }, testInfo) => {
    await signInAsDemo(page, {
      email: `block4-session-refresh-${Date.now()}@lexframe.local`,
      fullName: "Block4 Session Refresh User",
    });
    const api = await getWorkspaceApiSession(page, request);
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const directSession = await request.post(`${api.apiBaseUrl}/activepieces/session`, {
      headers: runtimeHeaders(api),
      data: {
        workspace_id: api.workspaceId,
        project_id: projectId,
        automation_id: canvas.automation_id,
        purpose: "automation_canvas",
        client_route: canvas.route,
        mode_preference: "auto",
        return_builder_config: true,
      },
    });
    expect(directSession.status(), await directSession.text()).toBeLessThan(500);
    const directSessionPayload = await directSession.json();
    expect(directSessionPayload.ttl_seconds ?? 0).toBeLessThanOrEqual(300);

    const sessionResponses: Response[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        response.url().includes("/activepieces/session")
      ) {
        sessionResponses.push(response);
      }
    });
    await page.goto(canvas.route);
    await waitForBuilderSurface(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBuilderSurface(page);
    await page.goto("/app/projects");
    await assertTokensClearedAfterLeavingAutomationFamily(page);

    await testInfo.attach("automation-session-refresh-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            directTtlSeconds: directSessionPayload.ttl_seconds ?? null,
            sessionResponses: sessionResponses.map((response) => ({
              status: response.status(),
              url: response.url(),
            })),
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
    expect(sessionResponses.length).toBeLessThanOrEqual(3);
    for (const response of sessionResponses) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
