import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  assertSettingsSecretNotExposed,
  installSettingsSecurityScan,
  settingsSecuritySnapshot,
} from "./utils/settings-security";

test.describe("@part6 settings write-only provider secrets", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("does not return, render or store a saved provider key after save and test", async ({
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const marker = `sk-part6-write-only-${runId}-secret-marker`;
    installSettingsSecurityScan(page, marker);

    await signInAsDemo(page, {
      email: `part6-write-only-${runId}@lexframe.local`,
      fullName: "Part6 Write Only",
    });
    const session = await getWorkspaceApiSession(page, request);
    await openAiSettings(page);

    await page.getByTestId("settings-ai-base-url-chat_ai").fill("https://api.example.com/v1");
    await page.getByTestId("settings-ai-model-id-chat_ai").fill(`part6-secret-model-${runId}`);
    await page.getByTestId("settings-ai-api-key-chat_ai").fill(marker);
    await expect(page.locator("body")).not.toContainText(marker);

    const saveResponse = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/settings/ai/route-groups/chat_ai") &&
        candidate.request().method() === "PATCH" &&
        candidate.ok(),
    );
    await page.getByTestId("settings-ai-save-chat_ai").click();
    await saveResponse;
    await expect(page.getByTestId("settings-ai-test-chat_ai")).toBeEnabled();

    const testResponse = page.waitForResponse(
      (candidate) =>
        /\/settings\/ai\/provider-connections\/[^/]+\/test$/.test(
          new URL(candidate.url()).pathname,
        ) &&
        candidate.request().method() === "POST" &&
        candidate.ok(),
    );
    await page.getByTestId("settings-ai-test-chat_ai").click();
    await testResponse;

    await page.reload();
    await openAiSettings(page);
    await assertSettingsSecretNotExposed(page, marker);

    const aiSettingsResponse = await request.get(`${session.apiBaseUrl}/settings/ai`, {
      headers: session.headers,
    });
    expect(aiSettingsResponse.ok()).toBeTruthy();
    const responseText = await aiSettingsResponse.text();
    expect(responseText).not.toContain(marker);
    expect(responseText).not.toMatch(/apiKey|api_key|authorization|Bearer/i);

    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "settings-write-only-security-summary", {
      security: settingsSecuritySnapshot(page),
      responseBytes: responseText.length,
    });
  });
});

async function openAiSettings(page: Page) {
  await page.goto("/app/projects");
  await page.getByTestId("settings-entry-point").click();
  await page.getByTestId("settings-tab-ai").click();
  await expect(page.getByTestId("settings-ai-route-card-chat_ai")).toBeVisible();
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
