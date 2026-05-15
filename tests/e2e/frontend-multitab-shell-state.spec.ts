import { expect, test, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertTokensClearedAfterLeavingAutomationFamily,
  scanStorageForActivepiecesJwt,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas } from "./utils/automation";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import {
  assertNoSecretLikeStringsInDomAndStorage,
  collectNetworkSummary,
  installNetworkSummary,
  waitForShellReady,
} from "./utils/shell-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block1 multitab shell state", () => {
  test("keeps sidebar and theme persistence from corrupting navigation across tabs", async ({
    context,
    page,
  }, testInfo) => {
    testInfo.setTimeout(90_000);
    installConsoleGuards(page);
    installNetworkSummary(page);
    await signInAsDemo(page, {
      email: `block1-multitab-${Date.now()}@lexframe.local`,
      fullName: "Block1 Multitab",
    });
    await page.goto("/app/projects");
    await waitForShellReady(page);

    const secondPage = await context.newPage();
    installConsoleGuards(secondPage);
    installNetworkSummary(secondPage);
    await secondPage.goto("/app/projects", { waitUntil: "domcontentloaded" });
    await waitForShellReady(secondPage);

    await page
      .getByRole("button", { name: /Свернуть меню|collapse/i })
      .click();
    await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    await page
      .getByRole("button", { name: /Включить|theme/i })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await secondPage.goto(`/app/projects/${projectId}/automations`, {
      waitUntil: "domcontentloaded",
    });
    await assertRouteReady(secondPage, "automations");
    await expect(secondPage.getByTestId("project-sidebar")).toHaveAttribute(
      "data-active-project-id",
      projectId,
    );
    await secondPage.reload({ waitUntil: "domcontentloaded" });
    await assertRouteReady(secondPage, "automations");
    await expect(secondPage.getByTestId("project-sidebar")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    await expect(secondPage.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByTestId("settings-entry-point").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await secondPage.goto(`/app/projects/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
    await assertRouteReady(secondPage, "project-workspace");
    await assertNoBlockingOverlay(secondPage);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await waitForShellReady(page);
    await assertNoBlockingOverlay(page);

    await assertNoSecretLikeStringsInDomAndStorage(page);
    await assertNoSecretLikeStringsInDomAndStorage(secondPage);
    await assertNoHydrationErrors(page);
    await assertNoHydrationErrors(secondPage);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoConsoleErrors(secondPage, [/Failed to load resource/i]);
    await attachJson(testInfo, "multitab-shell-state-network", {
      firstPage: await collectNetworkSummary(page),
      secondPage: await collectNetworkSummary(secondPage),
    });
  });

  test("cleans Activepieces browser tokens after leaving automation route family", async ({
    page,
    request,
  }, testInfo) => {
    installConsoleGuards(page);
    installNetworkSummary(page);
    await signInAsDemo(page, {
      email: `block1-ap-clean-${Date.now()}@lexframe.local`,
      fullName: "Block1 AP Clean",
    });

    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await page.goto(canvas.route, { waitUntil: "domcontentloaded" });
    await waitForBuilderSurface(page);
    const tokensInsideFamily = await scanStorageForActivepiecesJwt(page);

    await page.goto("/app/projects", { waitUntil: "domcontentloaded" });
    await assertRouteReady(page, "ordinary");
    await assertTokensClearedAfterLeavingAutomationFamily(page);
    await assertNoSecretLikeStringsInDomAndStorage(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "automation-token-cleanup-storage", {
      tokensInsideFamily,
      network: await collectNetworkSummary(page),
    });
  });
});

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
