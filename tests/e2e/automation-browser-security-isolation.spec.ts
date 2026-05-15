import { expect, test, type Request } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertTokensClearedAfterLeavingAutomationFamily,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";
import { startDryRun } from "./utils/canvas-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation browser security isolation", () => {
  test("automation canvas and dry-run make no direct provider/admin-key browser calls", async ({
    page,
    request,
  }, testInfo) => {
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-browser-isolation-${Date.now()}@lexframe.local`,
      fullName: "Block4 Browser Isolation User",
    });
    const requests: Array<{
      readonly method: string;
      readonly url: string;
      readonly hasAuthorization: boolean;
      readonly hasApiKeyHeader: boolean;
    }> = [];
    page.on("request", (candidate: Request) => {
      const headers = candidate.headers();
      requests.push({
        method: candidate.method(),
        url: candidate.url(),
        hasAuthorization: Boolean(headers.authorization),
        hasApiKeyHeader: Boolean(headers["x-api-key"] || headers.apikey),
      });
    });

    await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);
    await startDryRun(page);
    await page.goto("/app/projects");
    await assertTokensClearedAfterLeavingAutomationFamily(page);
    await assertNoAutomationBrowserSecrets(page);

    const forbiddenProviderCalls = requests.filter((entry) =>
      /api\.openai\.com|api\.anthropic\.com|api\.x\.ai|api\.deepseek\.com|api\.cometapi\.com/i.test(
        entry.url,
      ),
    );
    const forbiddenApAdminKeyCalls = requests.filter(
      (entry) =>
        /127\.0\.0\.1:8080|localhost:8080/i.test(entry.url) &&
        (/\/admin(\/|$)|\/api\/v1\/admin/i.test(new URL(entry.url).pathname) ||
          entry.hasApiKeyHeader),
    );

    await testInfo.attach("automation-browser-request-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            total: requests.length,
            forbiddenProviderCalls,
            forbiddenApAdminKeyCalls,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
    expect(forbiddenProviderCalls).toEqual([]);
    expect(forbiddenApAdminKeyCalls).toEqual([]);
  });
});
