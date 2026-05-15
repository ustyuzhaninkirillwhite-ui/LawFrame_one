import { expect, test } from "@playwright/test";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  assertNoProjectFlowSecurityLeaks,
  installNetworkSecurityAssertions,
} from "./utils/network-assertions";
import {
  composerInput,
  createProjectViaApi,
  delay,
  fulfillJson,
  isMswE2eRun,
  isProjectAutomations,
  isProjectKnowledge,
  isProjectSnapshot,
  openAutomationPicker,
  openProjectWorkspaceRoute,
  openProjectWorkspaceTab,
  projectShell,
  recordRequests,
  sendButton,
  setMswControls,
  signInForProjectWorkspace,
} from "./utils/project-workspace-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const secondaryProjectId =
  process.env.LEXFRAME_E2E_SECONDARY_PROJECT_ID ?? "project_research_002";

test.describe("@part2 project workspace API resilience", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInForProjectWorkspace(page, "Part2 Project API Resilience");
  });

  test("delayed project snapshot still renders shell and settles to current project", async ({
    page,
  }) => {
    const snapshots = recordRequests(page, isProjectSnapshot(projectId));
    if (isMswE2eRun) {
      await setMswControls(page, {
        delays: {
          [`GET /projects/${projectId}/snapshot`]: { delayMs: 600 },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/snapshot`, async (route) => {
        await delay(600);
        await route.continue();
      });
    }

    await page.goto(`/app/projects/${projectId}`, { waitUntil: "commit" });
    await expect(projectShell(page)).toBeVisible({ timeout: 15_000 });
    await expect(composerInput(page)).toBeVisible();
    await expect.poll(() => snapshots.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(composerInput(page)).toHaveAttribute("placeholder", /.+/);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("failed project knowledge affects only Sources tab", async ({ page }) => {
    if (isMswE2eRun) {
      await setMswControls(page, {
        failures: {
          [`GET /projects/${projectId}/knowledge`]: {
            status: 503,
            code: "PROJECT_KNOWLEDGE_DOWN",
            message: "Project knowledge unavailable.",
            remaining: 1,
          },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/knowledge`, async (route) => {
        await fulfillJson(route, { error: { code: "PROJECT_KNOWLEDGE_DOWN" } }, 503);
      });
    }
    const knowledge = recordRequests(page, isProjectKnowledge(projectId));

    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 chats still usable");
    await expect(sendButton(page)).toBeEnabled();
    await openProjectWorkspaceTab(page, "sources");
    await expect(projectShell(page)).toContainText(/Источники временно недоступны|sources.*unavailable/i);
    await openProjectWorkspaceTab(page, "automations");
    await expect(projectShell(page)).not.toContainText(/Источники временно недоступны|sources.*unavailable/i);
    expect(knowledge.length).toBeLessThanOrEqual(3);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("failed automations list does not block composer or Sources", async ({ page }) => {
    if (isMswE2eRun) {
      await setMswControls(page, {
        failures: {
          [`GET /projects/${projectId}/automations`]: {
            status: 503,
            code: "PROJECT_AUTOMATIONS_DOWN",
            message: "Project automations unavailable.",
            remaining: 1,
          },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/automations`, async (route) => {
        await fulfillJson(route, { error: { code: "PROJECT_AUTOMATIONS_DOWN" } }, 503);
      });
    }
    const automations = recordRequests(page, isProjectAutomations(projectId));

    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 text-only composer remains usable");
    await expect(sendButton(page)).toBeEnabled();
    await openProjectWorkspaceTab(page, "sources");
    await expect(composerInput(page)).toHaveValue("Part2 text-only composer remains usable");
    await openProjectWorkspaceTab(page, "automations");
    await expect(projectShell(page)).toContainText(/Автоматизации временно недоступны|automations.*unavailable/i);
    expect(automations.length).toBeLessThanOrEqual(3);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("project switch clears prompt and automation chip from previous project", async ({
    page,
    request,
  }) => {
    const targetProjectId = isMswE2eRun
      ? secondaryProjectId
      : await createProjectViaApi(page, request, `Part2 Switch Target ${Date.now()}`);
    await openProjectWorkspaceRoute(page, projectId);
    const primaryTitle = (await projectShell(page).locator("h1").innerText()).trim();
    await composerInput(page).fill("Part2 project A draft");
    await openAutomationPicker(page);
    const attachButtons = page.getByTestId("project-automation-picker").getByRole("button", {
      name: /Прикрепить|attach/i,
    });
    if ((await attachButtons.count()) > 0) {
      await attachButtons.first().click();
      await expect(page.getByTestId("selected-automation-chip")).toBeVisible();
    }

    await page.goto(`/app/projects/${targetProjectId}`, { waitUntil: "commit" });
    await expect(projectShell(page)).toBeVisible({ timeout: 20_000 });
    await expect(composerInput(page)).toHaveValue("");
    await expect(page.getByTestId("selected-automation-chip")).toHaveCount(0);
    await expect
      .poll(async () => (await projectShell(page).locator("h1").innerText()).trim(), {
        timeout: 15_000,
      })
      .not.toBe(primaryTitle);
    await expect(page).toHaveURL(new RegExp(`/app/projects/${targetProjectId}`));
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
