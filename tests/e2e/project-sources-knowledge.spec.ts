import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoProjectFlowSecurityLeaks, installNetworkSecurityAssertions } from "./utils/network-assertions";
import { openProjectTab, openProjectWorkspace } from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const foreignProjectId = "foreign_project_001";

test.describe("@block3 project sources and knowledge", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-knowledge-${Date.now()}@lexframe.local`,
      fullName: "Block3 Knowledge User",
    });
  });

  test("keeps project knowledge scoped and routes web search through LexFrame backend", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };
    const sourceId = `block3-note-${Date.now()}`;

    const createKnowledgeResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/knowledge`,
      {
        headers,
        data: {
          sourceType: "manual_note",
          sourceId,
          mode: "project_knowledge",
          classification: "workspace_internal",
          pinned: true,
          enabledForChat: true,
          citationRequired: true,
        },
      },
    );
    expect(createKnowledgeResponse.ok(), await createKnowledgeResponse.text()).toBeTruthy();
    const knowledgeItem = (await createKnowledgeResponse.json()) as {
      readonly id: string;
      readonly sourceId: string;
      readonly projectId: string;
    };
    expect(knowledgeItem.sourceId).toBe(sourceId);
    expect(knowledgeItem.projectId).toBe(projectId);

    const listKnowledgeResponse = await request.get(
      `${session.apiBaseUrl}/projects/${projectId}/knowledge`,
      { headers: session.headers },
    );
    expect(listKnowledgeResponse.ok(), await listKnowledgeResponse.text()).toBeTruthy();
    const listKnowledgeText = await listKnowledgeResponse.text();
    expect(listKnowledgeText).toContain(sourceId);
    expect(listKnowledgeText).not.toMatch(/TAVILY_API_KEY|OPENAI_API_KEY|service_role/i);

    const searchResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/web-search`,
      {
        headers,
        data: {
          query: "судебная практика обеспечительные меры договор поставки",
          saveResults: true,
          maxResults: 2,
        },
      },
    );
    expect(searchResponse.status()).toBeLessThan(500);
    const searchText = await searchResponse.text();
    expect(searchText).not.toMatch(/TAVILY_API_KEY|OPENAI_API_KEY|service_role|Authorization/i);

    const foreignKnowledgeResponse = await request.get(
      `${session.apiBaseUrl}/projects/${foreignProjectId}/knowledge`,
      { headers: session.headers },
    );
    expect(foreignKnowledgeResponse.status()).toBeGreaterThanOrEqual(400);
    expect(foreignKnowledgeResponse.status()).toBeLessThan(500);

    await openProjectWorkspace(page, projectId);
    await assertRouteReady(page, "project-workspace");
    await openProjectTab(page, "sources");
    await expect(page.locator("body")).toContainText(/Источник|Источники|source/i, {
      timeout: 20_000,
    });
    await page.goto(`/app/projects/${foreignProjectId}`);
    await expect(page.locator("body")).not.toContainText(sourceId);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
