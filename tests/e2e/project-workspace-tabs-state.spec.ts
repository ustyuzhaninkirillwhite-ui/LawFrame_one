import { expect, test } from "@playwright/test";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { installNetworkSecurityAssertions, assertNoProjectFlowSecurityLeaks } from "./utils/network-assertions";
import {
  assertNoWorkspaceSkeleton,
  composerInput,
  isProjectAutomations,
  isProjectChatCreate,
  isProjectEndpoint,
  isProjectKnowledge,
  openProjectWorkspaceRoute,
  openProjectWorkspaceTab,
  projectShell,
  projectTab,
  recordRequests,
  signInForProjectWorkspace,
} from "./utils/project-workspace-runtime";
import {
  assertNoDuplicateShellComposers,
  assertNoOldProjectDashboard,
} from "./utils/visual-invariants";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@part2 project workspace tabs and route state", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInForProjectWorkspace(page, "Part2 Project Tabs");
  });

  test("direct project workspace load exposes project context without old dashboard", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);

    await expect(projectShell(page)).toBeVisible();
    await expect(composerInput(page)).toHaveAttribute("placeholder", /.+/);
    await expect(projectTab(page, "chats")).toHaveAttribute("aria-selected", "true");
    await expect(projectTab(page, "sources")).toBeVisible();
    await expect(projectTab(page, "automations")).toBeVisible();
    await assertNoOldProjectDashboard(page);
    await assertNoDuplicateShellComposers(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });

  test("tab switching preserves composer draft and avoids request storm", async ({
    page,
  }) => {
    const chats = recordRequests(page, isProjectEndpoint(projectId, "/chats"));
    const knowledge = recordRequests(page, isProjectKnowledge(projectId));
    const automations = recordRequests(page, isProjectAutomations(projectId));
    const creates = recordRequests(page, isProjectChatCreate(projectId));

    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 draft survives tab switches");

    await openProjectWorkspaceTab(page, "sources");
    await openProjectWorkspaceTab(page, "automations");
    await openProjectWorkspaceTab(page, "chats");
    await openProjectWorkspaceTab(page, "sources");

    await expect(composerInput(page)).toHaveValue("Part2 draft survives tab switches");
    await expect(projectTab(page, "sources")).toHaveAttribute("aria-selected", "true");
    await assertNoWorkspaceSkeleton(page);
    expect(chats.length).toBeLessThanOrEqual(3);
    expect(knowledge.length).toBeLessThanOrEqual(3);
    expect(automations.length).toBeLessThanOrEqual(3);
    expect(creates).toHaveLength(0);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("browser back and forward keep selected project tab and DOM aligned", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);
    await openProjectWorkspaceTab(page, "sources");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=sources$`));

    await openProjectWorkspaceTab(page, "automations");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=automations$`));

    await page.goBack();
    await expect(projectTab(page, "sources")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=sources$`));

    await page.goForward();
    await expect(projectTab(page, "automations")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=automations$`));
    await assertNoWorkspaceSkeleton(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});
