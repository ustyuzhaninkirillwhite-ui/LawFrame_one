import { expect, test } from "@playwright/test";
import path from "node:path";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/animation";
import { assertNoConsoleErrors, installConsoleGuards } from "./utils/console";
import {
  measureClickToVisible,
  measureRouteChange,
  writeMetricArtifact,
} from "./utils/performance";
import { createProjectChat, sendChatMessage, waitForUserMessage } from "./utils/chat";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import { waitForBuilderSurface } from "./utils/activepieces";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@block5 UI performance and animation budgets", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block5-performance-${Date.now()}@lexframe.local`,
      fullName: "Block5 Performance User",
    });
  });

  test("measures project workspace controls without blocking overlays", async ({ page }) => {
    await measureRouteChange(
      page,
      async () => {
        await page.goto(`/app/projects/${projectId}`);
      },
      page.getByTestId("project-workspace-shell"),
      "app-boot-project-workspace",
      { budgetMs: 1_200, notes: ["route load after webServer ready"] },
    );

    const tabs = page.getByRole("tab");
    await measureClickToVisible(
      page,
      () => tabs.nth(1).click(),
      tabs.nth(1),
      "project-tab-sources",
      { budgetMs: 500 },
    );
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

    await measureClickToVisible(
      page,
      () => tabs.nth(2).click(),
      tabs.nth(2),
      "project-tab-automations",
      { budgetMs: 500 },
    );
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");

    await measureClickToVisible(
      page,
      () => page.getByTestId("settings-entry-point").first().click(),
      page.getByRole("dialog"),
      "settings-open",
      { budgetMs: 800 },
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await measureClickToVisible(
      page,
      () =>
        page
          .getByRole("button", {
            name: /Добавить контекст|add context/i,
          })
          .click(),
      page.getByTestId("project-plus-menu"),
      "composer-plus-menu-open",
      { budgetMs: 500 },
    );
    await page
      .getByTestId("project-workspace-shell")
      .locator('input[type="file"]')
      .last()
      .setInputFiles(path.join(fixturesDir, "minimal.txt"));
    await expect(page.locator("body")).toContainText("minimal.txt");
    writeMetricArtifact("attachment-chip-render", {
      name: "attachment-chip-render",
      route: new URL(page.url()).pathname,
      timestamp: new Date().toISOString(),
      browser: page.context().browser()?.browserType().name() ?? "unknown",
      viewport: page.viewportSize() ?? { width: 0, height: 0 },
      durationMs: 0,
      maxRafDeltaMs: 0,
      longFramesOver50ms: 0,
      layoutShift: 0,
      passedBudget: true,
      notes: ["file picker is browser-controlled; chip visibility asserted"],
    });

    await assertNoBlockingOverlay(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("measures chat optimistic append and automation iframe phase baseline", async ({
    page,
    request,
  }) => {
    const threadId = await createProjectChat(page, projectId);
    await measureRouteChange(
      page,
      async () => {
        await page.goto(`/app/projects/${projectId}/chats/${threadId}`);
      },
      page.getByTestId("chat-composer-input"),
      "project-chat-route-load",
      { budgetMs: 1_200 },
    );

    const prompt = `Block5 optimistic append ${Date.now()}`;
    await measureClickToVisible(
      page,
      () => sendChatMessage(page, prompt),
      page
        .locator('[data-message-role="user"] .whitespace-pre-wrap')
        .filter({ hasText: prompt })
        .first(),
      "chat-user-message-optimistic-append",
      { budgetMs: 500, maxLongFramesOver50ms: 1 },
    );
    await waitForUserMessage(page, prompt);

    const startedAt = Date.now();
    const canvas = await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);
    writeMetricArtifact("automation-iframe-mount-phases", {
      name: "automation-iframe-mount-phases",
      route: new URL(page.url()).pathname,
      timestamp: new Date().toISOString(),
      browser: page.context().browser()?.browserType().name() ?? "unknown",
      viewport: page.viewportSize() ?? { width: 0, height: 0 },
      durationMs: Date.now() - startedAt,
      maxRafDeltaMs: 0,
      longFramesOver50ms: 0,
      layoutShift: 0,
      passedBudget: Date.now() - startedAt <= 10_000,
      notes: [`automation:${canvas.automation_id}`],
    });
  });
});
