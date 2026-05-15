import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { withApiFailureOnce } from "./utils/shell-runtime";

test.describe("@part6 settings profile and organization", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("persists profile display name after reload and keeps dirty value on fail-once save", async ({
    page,
  }, testInfo) => {
    const runId = Date.now();
    const displayName = `Part6 Profile ${runId}`;
    const failedDraft = `Part6 Failed Draft ${runId}`;

    await signInAsDemo(page, {
      email: `part6-profile-${runId}@lexframe.local`,
      fullName: "Part6 Profile",
    });
    await openSettings(page);
    await page.getByTestId("settings-profile-display-name").fill(displayName);
    await saveSettings(page, "settings-save-button", "/settings/profile");
    await page.reload();
    await openSettings(page);
    await expect(page.getByTestId("settings-profile-display-name")).toHaveValue(
      displayName,
    );

    await withApiFailureOnce(page, /\/settings\/profile$/, 503, {
      error: {
        code: "SETTINGS_PROFILE_TEMPORARILY_UNAVAILABLE",
        message: "Profile settings were not saved. Try again.",
      },
    });
    await page.getByTestId("settings-profile-display-name").fill(failedDraft);
    await page.getByTestId("settings-save-button").click();
    await expect(page.getByTestId("settings-profile-display-name")).toHaveValue(
      failedDraft,
    );
    await expect(page.getByRole("dialog")).not.toContainText(
      /stack trace|Authorization|Bearer|sk-/i,
    );

    await saveSettings(page, "settings-save-button", "/settings/profile");
    await page.reload();
    await openSettings(page);
    await expect(page.getByTestId("settings-profile-display-name")).toHaveValue(
      failedDraft,
    );
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "settings-profile-summary", {
      displayName,
      failedDraftRecovered: failedDraft,
    });
  });

  test("organization fields save only in the active workspace context", async ({
    page,
  }, testInfo) => {
    const runId = Date.now();
    const orgName = `Part6 Org ${runId}`;

    await signInAsDemo(page, {
      email: `part6-org-${runId}@lexframe.local`,
      fullName: "Part6 Org",
    });
    await openSettings(page);
    await page.getByTestId("settings-tab-organization").click();
    await expect(page.getByTestId("settings-organization-display-name")).toBeVisible();
    await page.getByTestId("settings-organization-display-name").fill(orgName);
    await saveSettings(page, "settings-save-button", "/settings/organization");
    await page.reload();
    await openSettings(page);
    await page.getByTestId("settings-tab-organization").click();
    await expect(page.getByTestId("settings-organization-display-name")).toHaveValue(
      orgName,
    );
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "settings-organization-summary", { orgName });
  });
});

async function openSettings(page: Page) {
  await page.goto("/app/projects");
  await page.getByTestId("settings-entry-point").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("settings-profile-display-name")).toBeVisible();
}

async function saveSettings(page: Page, buttonTestId: string, endpoint: string) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(endpoint) &&
      candidate.request().method() === "PATCH" &&
      candidate.ok(),
  );
  await page.getByTestId(buttonTestId).click();
  await response;
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
