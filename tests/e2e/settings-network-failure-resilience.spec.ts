import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";
import { withApiFailureOnce } from "./utils/shell-runtime";

test.describe("@part6 settings network failure resilience", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("keeps AI route form recoverable after failed metadata save and redacts provider-like errors", async ({
    page,
  }, testInfo) => {
    const runId = Date.now();
    const marker = `sk-part6-failure-${runId}-secret`;
    const modelId = `part6-failure-model-${runId}`;
    const rawProviderError = [
      "Upstream provider failed with",
      "Authorization:",
      "Bearer",
      "sk-leaked-provider-key-123456",
    ].join(" ");

    await withApiFailureOnce(
      page,
      /\/settings\/ai\/provider-connections(?:\/[^/]+\/secret)?$/,
      502,
      {
        error: {
          code: "AI_PROVIDER_TEMPORARILY_UNAVAILABLE",
          message: rawProviderError,
        },
      },
    );

    await signInAsDemo(page, {
      email: `part6-network-${runId}@lexframe.local`,
      fullName: "Part6 Network",
    });
    await page.goto("/app/projects");
    await page.getByTestId("settings-entry-point").click();
    await page.getByTestId("settings-tab-ai").click();
    await page.getByTestId("settings-ai-base-url-chat_ai").fill("https://api.example.com/v1");
    await page.getByTestId("settings-ai-model-id-chat_ai").fill(modelId);
    await revealApiKeyInput(page, "chat_ai");
    await page.getByTestId("settings-ai-api-key-chat_ai").fill(marker);

    await page.getByTestId("settings-ai-save-chat_ai").click();
    await expect(page.getByTestId("settings-ai-model-id-chat_ai")).toHaveValue(
      modelId,
    );
    await expect(page.getByTestId("settings-ai-api-key-chat_ai")).toHaveValue(
      marker,
    );
    await expect(page.getByRole("dialog")).not.toContainText(
      /sk-leaked-provider-key|Authorization: Bearer|stack trace/i,
    );

    const retry = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/settings/ai/route-groups/chat_ai") &&
        candidate.request().method() === "PATCH" &&
        candidate.ok(),
    );
    await page.getByTestId("settings-ai-save-chat_ai").click();
    await retry;
    await expect(page.locator("body")).not.toContainText(marker);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await testInfo.attach("settings-network-failure-summary", {
      body: Buffer.from(
        `${JSON.stringify({ modelId, recoveredAfterRetry: true }, null, 2)}\n`,
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
