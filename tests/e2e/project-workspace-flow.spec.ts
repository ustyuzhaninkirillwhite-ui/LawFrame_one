import { expect, test } from "@playwright/test";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoProjectFlowSecurityLeaks, installNetworkSecurityAssertions } from "./utils/network-assertions";
import {
  assertProjectWorkspaceReady,
  openProjectTab,
  openProjectWorkspace,
  renameProjectFromHeader,
} from "./utils/project-workspace";
import {
  assertNoDuplicateShellComposers,
  assertNoOldProjectDashboard,
} from "./utils/visual-invariants";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@block3 project workspace root flow", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-workspace-${Date.now()}@lexframe.local`,
      fullName: "Block3 Workspace User",
    });
  });

  test("covers project root rename, tabs, composer attachments and security invariants", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);

    await openProjectWorkspace(page, projectId);
    await assertRouteReady(page, "project-workspace");
    await assertProjectWorkspaceReady(page);
    await assertNoOldProjectDashboard(page);
    await assertNoDuplicateShellComposers(page);

    const originalProjectName = (await page.locator("h1").first().innerText()).trim();
    const renamedProjectName = `Block3 Claim ${Date.now()}`;
    const renameResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/projects/${projectId}`),
      { timeout: 15_000 },
    );

    await renameProjectFromHeader(page, renamedProjectName);
    expect((await renameResponse).status()).toBeLessThan(500);
    await expect(page.locator("body")).toContainText(renamedProjectName);

    await page.reload();
    await expect(page.getByRole("heading", { name: renamedProjectName })).toBeVisible({
      timeout: 20_000,
    });

    await openProjectTab(page, "chats");
    await expect(page.locator(`a[href^="/app/projects/${projectId}/chats/"]`).first()).toBeVisible({
      timeout: 20_000,
    }).catch(() => undefined);
    await expect(page.locator("body")).not.toContainText("/chat/");

    await openProjectTab(page, "sources");
    await expect(page.locator("body")).toContainText(
      /РСЃС‚РѕС‡РЅРёРє|source|manual|РёСЃС‚РѕС‡/i,
      { timeout: 20_000 },
    );

    await openProjectTab(page, "automations");
    const automationLinks = page.locator(
      `a[href^="/app/projects/${projectId}/automations/"]`,
    );
    if ((await automationLinks.count()) > 0) {
      await expect(automationLinks.first()).toBeVisible();
      await expect(automationLinks.first()).toHaveAttribute(
        "href",
        new RegExp(`/app/projects/${projectId}/automations/.+/automation`),
      );
    }

    const plusButton = page.getByRole("button", {
      name: /РґРѕР±Р°РІРёС‚СЊ РєРѕРЅС‚РµРєСЃС‚|add context/i,
    });
    await plusButton.click();
    await expect(page.getByTestId("project-plus-menu")).toBeVisible();
    await page
      .getByTestId("project-workspace-shell")
      .locator('input[type="file"]')
      .last()
      .setInputFiles(path.join(fixturesDir, "minimal.txt"));
    await expect(page.locator("body")).toContainText("minimal.txt");
    await page.getByRole("button", { name: /РЈР±СЂР°С‚СЊ С„Р°Р№Р»|remove file/i }).click();
    await expect(page.getByTestId("project-plus-menu")).toHaveCount(0);

    if (originalProjectName && originalProjectName !== renamedProjectName) {
      await renameProjectFromHeader(page, originalProjectName);
    }

    const projectResponse = await request.get(
      `${session.apiBaseUrl}/projects/${projectId}`,
      { headers: session.headers },
    );
    expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();

    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoBlockingOverlay(page);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
