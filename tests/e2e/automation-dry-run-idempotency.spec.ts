import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { ensureAutomationCanvas, runtimeHeaders } from "./utils/automation";
import { assertRunEvidenceSafe } from "./utils/run-evidence";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation dry-run idempotency", () => {
  test("repeated backend dry-run POST with the same idempotency key returns one workflow run", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `block4-idempotency-${Date.now()}@lexframe.local`,
      fullName: "Block4 Idempotency User",
    });
    const session = await getWorkspaceApiSession(page, request);
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const idempotencyKey = `block4-live-idempotency-${Date.now()}`;
    const endpoint = `${session.apiBaseUrl}/automations/${canvas.automation_id}/run`;
    const data = {
      mode: "dry_run",
      idempotencyKey,
    };

    const first = await request.post(endpoint, {
      headers: runtimeHeaders(session),
      data,
    });
    expect(first.status(), await first.text()).toBeLessThan(500);
    const firstPayload = await first.json();
    assertRunEvidenceSafe(firstPayload);
    expect(firstPayload.runId).toBeTruthy();

    const second = await request.post(endpoint, {
      headers: runtimeHeaders(session),
      data,
    });
    expect(second.status(), await second.text()).toBeLessThan(500);
    const secondPayload = await second.json();
    assertRunEvidenceSafe(secondPayload);

    expect(secondPayload.runId).toBe(firstPayload.runId);
    expect(secondPayload.traceId).toBe(firstPayload.traceId);
    expect(secondPayload.externalRunId ?? null).toBe(firstPayload.externalRunId ?? null);
  });
});
