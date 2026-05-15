import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertSettingsSecretNotExposed,
  installSettingsSecurityScan,
  settingsSecuritySnapshot,
} from "./utils/settings-security";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";

test.describe("@part6 settings browser security isolation", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("settings save and connection test stay backend-only with no provider/browser secret calls", async ({
    page,
  }, testInfo) => {
    const runId = Date.now();
    const marker = `sk-part6-browser-isolation-${runId}-secret`;
    installSettingsSecurityScan(page, marker);

    await signInAsDemo(page, {
      email: `part6-browser-security-${runId}@lexframe.local`,
      fullName: "Part6 Browser Security",
    });
    await page.goto("/app/projects");
    await page.getByTestId("settings-entry-point").click();
    await page.getByTestId("settings-tab-ai").click();
    await page.getByTestId("settings-ai-base-url-chat_ai").fill("https://api.example.com/v1");
    await page
      .getByTestId("settings-ai-model-id-chat_ai")
      .fill(`part6-browser-security-${runId}`);
    await revealApiKeyInput(page, "chat_ai");
    await page.getByTestId("settings-ai-api-key-chat_ai").fill(marker);

    const routeSave = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/settings/ai/route-groups/chat_ai") &&
        candidate.request().method() === "PATCH" &&
        candidate.ok(),
    );
    await page.getByTestId("settings-ai-save-chat_ai").click();
    await routeSave;
    await expect(page.getByTestId("settings-ai-test-chat_ai")).toBeEnabled();

    const testConnection = page.waitForResponse(
      (candidate) =>
        /\/settings\/ai\/provider-connections\/[^/]+\/test$/.test(
          new URL(candidate.url()).pathname,
        ) &&
        candidate.request().method() === "POST" &&
        candidate.ok(),
    );
    await page.getByTestId("settings-ai-test-chat_ai").click();
    await testConnection;

    await assertSettingsSecretNotExposed(page, marker);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await testInfo.attach("settings-browser-security-summary", {
      body: Buffer.from(
        `${JSON.stringify(settingsSecuritySnapshot(page), null, 2)}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});

async function revealApiKeyInput(
  page: import("@playwright/test").Page,
  routeGroup: "chat_ai" | "automation_ai",
) {
  if ((await page.getByTestId(`settings-ai-api-key-${routeGroup}`).count()) > 0) {
    return;
  }

  await page
    .getByTestId(`settings-ai-route-card-${routeGroup}`)
    .getByRole("button")
    .first()
    .click();
}
