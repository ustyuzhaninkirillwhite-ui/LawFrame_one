import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import { expectReadinessProfile } from "./helpers/readiness";

interface LibraryTemplateSummary {
  readonly id: string;
  readonly title: string;
}

interface InstalledAutomationDetail {
  readonly id: string;
  readonly runtimeProjectId: string | null;
  readonly runtimeFlowId: string | null;
}

interface SyncAutomationRuntimeResponse {
  readonly status: "synced" | "noop" | "failed";
  readonly runtimeProjectId: string;
  readonly runtimeFlowId: string;
}

interface ActivepiecesIntegrationStatus {
  readonly canDispatchRealRuns: boolean;
  readonly smokePresetCodes: readonly string[];
}

interface ActivepiecesEmbedTokenResponse {
  readonly token: string;
  readonly mode: string;
  readonly runtimeProjectId: string | null;
  readonly runtimeFlowId: string | null;
}

interface ActivepiecesRunSmokeResponse {
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

test.describe("Stage 4 Activepieces integrated smoke", () => {
  test("local-integrated syncs runtime, issues embed token and closes the smoke run loop", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `activepieces-integrated-${Date.now()}@lexframe.local`,
      fullName: "Stage4 Activepieces Integrated",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    const session = await getWorkspaceApiSession(page, request);
    const jsonHeaders = {
      ...session.headers,
      "content-type": "application/json",
    };

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
    expect(installed.id).toBeTruthy();

    const syncResponse = await request.post(
      `${session.apiBaseUrl}/automations/${installed.id}/runtime/sync`,
      {
        headers: jsonHeaders,
        data: {
          dryRun: true,
        },
      },
    );
    expect(syncResponse.ok()).toBeTruthy();
    const syncPayload =
      (await syncResponse.json()) as SyncAutomationRuntimeResponse;
    expect(syncPayload.status).toBe("synced");
    expect(syncPayload.runtimeProjectId).toBeTruthy();
    expect(syncPayload.runtimeFlowId).toBeTruthy();

    const statusResponse = await request.get(
      `${session.apiBaseUrl}/integrations/activepieces/status`,
      {
        headers: session.headers,
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    const statusPayload =
      (await statusResponse.json()) as ActivepiecesIntegrationStatus;
    expect(statusPayload.canDispatchRealRuns).toBeTruthy();
    expect(statusPayload.smokePresetCodes).toContain("legal-research-to-draft");

    const tokenResponse = await request.post(
      `${session.apiBaseUrl}/activepieces/embed-token`,
      {
        headers: jsonHeaders,
        data: {
          installedAutomationId: installed.id,
          purpose: "builder",
        },
      },
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const tokenPayload =
      (await tokenResponse.json()) as ActivepiecesEmbedTokenResponse;
    expect(tokenPayload.token).toBeTruthy();
    expect(tokenPayload.mode).toBe("embedded-builder");
    expect(tokenPayload.runtimeProjectId).toBeTruthy();
    expect(tokenPayload.runtimeFlowId).toBeTruthy();

    await page.goto(`/automations/${installed.id}/builder`);
    await expect(page.getByText("Builder session")).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/automations/${installed.id}/builder$`),
    );

    const smokeResponse = await request.post(
      `${session.apiBaseUrl}/activepieces/run-smoke`,
      {
        headers: jsonHeaders,
        data: {
          automationId: installed.id,
          mode: "dry_run",
        },
      },
    );
    expect(smokeResponse.ok()).toBeTruthy();
    const smokePayload =
      (await smokeResponse.json()) as ActivepiecesRunSmokeResponse;
    expect(smokePayload.status).toBe("completed");
    expect(smokePayload.runId).toBeTruthy();
    expect(smokePayload.externalRunId).toBeTruthy();
    expect(smokePayload.artifactIds.length).toBeGreaterThan(0);
    expect(smokePayload.callbackReceiptSummary.received).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      smokePayload.callbackReceiptSummary.processed,
    ).toBeGreaterThanOrEqual(3);
    expect(smokePayload.callbackReceiptSummary.types).toContain("artifact");
    expect(smokePayload.callbackReceiptSummary.types).toContain("run_event");
    expect(smokePayload.callbackReceiptSummary.types).toContain("step_event");
  });
});
