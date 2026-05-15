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
  delay,
  fulfillJson,
  isMswE2eRun,
  isProjectKnowledge,
  isProjectWebSearch,
  openProjectWorkspaceRoute,
  openProjectWorkspaceTab,
  openWebSearchPanel,
  projectKnowledgeItem,
  projectShell,
  recordRequests,
  setMswControls,
  signInForProjectWorkspace,
  webSearchPanel,
} from "./utils/project-workspace-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@part2 project web-search and sources", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInForProjectWorkspace(page, "Part2 Project Web Search");
  });

  test("delayed web search response does not inject results into chats tab", async ({
    page,
  }) => {
    const delayedTitle = isMswE2eRun
      ? "Web source: part2 delayed result"
      : "Part2 Delayed Search Source";
    if (isMswE2eRun) {
      await setMswControls(page, {
        delays: {
          [`POST /projects/${projectId}/web-search`]: { delayMs: 500 },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/web-search`, async (route) => {
        await delay(500);
        await fulfillJson(route, {
          provider: "tavily",
          status: "ok",
          items: [
            {
              id: "web_part2_delayed",
              title: delayedTitle,
              url: "https://example.test/part2-delayed",
              snippet: "Delayed deterministic result",
              sourceType: "web_search_result",
              knowledgeItemId: "knowledge_part2_delayed",
              createdAt: new Date().toISOString(),
            },
          ],
          error: null,
        });
      });
    }

    await openProjectWorkspaceRoute(page, projectId);
    await openWebSearchPanel(page);
    await webSearchPanel(page).locator("input").fill("part2 delayed result");
    await webSearchPanel(page).locator('button[type="submit"]').click();
    await openProjectWorkspaceTab(page, "chats");

    await expect(projectShell(page)).not.toContainText(delayedTitle);
    await expect.poll(async () => webSearchPanel(page).count(), { timeout: 5_000 }).toBe(0);
    await expect(projectShell(page)).not.toContainText(delayedTitle);

    await openProjectWorkspaceTab(page, "sources");
    await expect(projectShell(page).getByText(delayedTitle)).toHaveCount(1);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("web search failure is controlled and redacted", async ({ page }) => {
    if (isMswE2eRun) {
      await setMswControls(page, {
        failures: {
          [`POST /projects/${projectId}/web-search`]: {
            status: 503,
            code: "provider_failed",
            message: "TAVILY_API_KEY leaked provider stack",
            remaining: 1,
          },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/web-search`, async (route) => {
        await fulfillJson(
          route,
          {
            error: {
              code: "provider_failed",
              message: "TAVILY_API_KEY leaked provider stack",
            },
          },
          503,
        );
      });
    }

    await openProjectWorkspaceRoute(page, projectId);
    await openWebSearchPanel(page);
    await webSearchPanel(page).locator("input").fill("part2 provider failure");
    await webSearchPanel(page).locator('button[type="submit"]').click();

    await expect(webSearchPanel(page)).toContainText(/Поиск временно недоступен|temporarily/i);
    await expect(webSearchPanel(page)).not.toContainText(/TAVILY_API_KEY|provider stack|Authorization/i);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });

  test("saved web result appears once after invalidate and reload", async ({ page }) => {
    const sourceTitle = isMswE2eRun
      ? "Block2 Web Search Source"
      : "Part2 Persisted Web Source";
    const sourceUrl = isMswE2eRun
      ? "https://example.test/block2/web-search-source"
      : "https://example.test/part2-persisted-source";
    const item = projectKnowledgeItem({
      id: "knowledge_part2_persisted",
      projectId,
      title: sourceTitle,
      url: sourceUrl,
    });
    let saved = false;
    const knowledgeRequests = recordRequests(page, isProjectKnowledge(projectId));
    const searchRequests = recordRequests(page, isProjectWebSearch(projectId));

    if (!isMswE2eRun) {
      await page.route(`**/projects/${projectId}/knowledge`, async (route) => {
        await fulfillJson(route, { items: saved ? [item] : [] });
      });
      await page.route(`**/projects/${projectId}/web-search`, async (route) => {
        saved = true;
        await fulfillJson(route, {
          provider: "tavily",
          status: "ok",
          items: [
            {
              id: "web_part2_persisted",
              title: sourceTitle,
              url: sourceUrl,
              snippet: "Persisted deterministic result",
              sourceType: "web_search_result",
              knowledgeItemId: item.id,
              createdAt: new Date().toISOString(),
            },
          ],
          error: null,
        });
      });
    }

    await openProjectWorkspaceRoute(page, projectId);
    await openWebSearchPanel(page);
    await webSearchPanel(page)
      .locator("input")
      .fill(isMswE2eRun ? "block2 saved web source" : "part2 persisted source");
    await webSearchPanel(page).locator('button[type="submit"]').click();
    await expect(webSearchPanel(page)).toHaveCount(0);
    await openProjectWorkspaceTab(page, "sources");
    await expect(projectShell(page).getByText(sourceTitle)).toHaveCount(1);

    if (!isMswE2eRun) {
      await page.reload();
      await openProjectWorkspaceTab(page, "sources");
      await expect(projectShell(page).getByText(sourceTitle)).toHaveCount(1);
    }
    expect(searchRequests).toHaveLength(1);
    expect(knowledgeRequests.length).toBeLessThanOrEqual(4);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
