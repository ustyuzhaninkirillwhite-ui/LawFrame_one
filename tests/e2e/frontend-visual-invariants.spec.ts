import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { signInAsDemo } from "./helpers/auth";
import { installConsoleGuards } from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import {
  assertBodyNotScrollableWhenRouteRequiresHScreen,
  assertNoDuplicateShellComposers,
  assertNoOldProjectDashboard,
} from "./utils/visual-invariants";

const projectId = "project_claim_001";
const screenshotDir = join(
  __dirname,
  "..",
  "..",
  "artifacts",
  "system-tests",
  "block2-frontend",
  "screenshots",
);

test.describe("@block2 frontend visual invariants", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    mkdirSync(screenshotDir, { recursive: true });
    await signInAsDemo(page, {
      email: `block2-visual-${Date.now()}@lexframe.local`,
      fullName: "Block2 Visual",
    });
  });

  for (const surface of [
    { name: "ordinary-projects", path: "/app/projects", kind: "ordinary" as const },
    {
      name: "project-workspace",
      path: `/app/projects/${projectId}`,
      kind: "project-workspace" as const,
    },
    {
      name: "project-chat",
      path: `/app/projects/${projectId}/chats/chat_project_claim_001`,
      kind: "project-chat" as const,
    },
    { name: "global-chat", path: "/chat", kind: "global-chat" as const },
    { name: "documents-root", path: "/documents", kind: "documents" as const },
    { name: "sources-root", path: "/sources", kind: "sources" as const },
    {
      name: "automations-root",
      path: `/app/projects/${projectId}/automations`,
      kind: "automations" as const,
    },
  ]) {
    test(`captures ${surface.name}`, async ({ page }) => {
      await page.goto(surface.path);
      await assertRouteReady(page, surface.kind);
      await assertNoDuplicateShellComposers(page);

      if (surface.kind === "project-workspace") {
        await assertNoOldProjectDashboard(page);
      }
      if (surface.kind === "project-chat" || surface.kind === "global-chat") {
        await assertBodyNotScrollableWhenRouteRequiresHScreen(page);
      }

      await page.screenshot({
        path: join(screenshotDir, `${surface.name}.png`),
        fullPage: true,
      });
    });
  }

  test("captures settings dialog and collapsed sidebar states", async ({ page }) => {
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    await page.screenshot({
      path: join(screenshotDir, "sidebar-expanded.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Свернуть меню" }).click();
    await page.screenshot({
      path: join(screenshotDir, "sidebar-collapsed.png"),
      fullPage: true,
    });

    await page.getByTestId("settings-entry-point").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: join(screenshotDir, "settings-dialog.png"),
      fullPage: true,
    });
  });
});
