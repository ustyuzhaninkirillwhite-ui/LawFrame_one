import { expect, test, type Route } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertRouteReady } from "./utils/navigation";

test.describe("@part8 search navigation/cache race", () => {
  test("late response for an old query does not overwrite the current search results", async ({
    page,
  }) => {
    let oldQueryRoute: Route | null = null;
    await page.route("**/legal-search/query", async (route) => {
      const body = route.request().postDataJSON() as { readonly query?: string };
      if (body.query === "part8 delayed old query") {
        oldQueryRoute = route;
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(searchPayload("Part8 Fresh Current Result")),
      });
    });

    await signInAsDemo(page, {
      email: `part8-search-race-${Date.now()}@lexframe.local`,
      fullName: "Part8 Search Race",
    });
    await page.goto("/research");
    await assertRouteReady(page, "ordinary");

    const input = page.getByTestId("legal-search-query-input");
    await input.fill("part8 delayed old query");
    await expect
      .poll(() => oldQueryRoute !== null, {
        message: "old query request should be captured before the next query",
      })
      .toBe(true);

    const freshResponse = page.waitForResponse((response) =>
      response.url().includes("/legal-search/query"),
    );
    await input.fill("part8 fresh current query");
    await freshResponse;
    await expect(page.locator("body")).toContainText(
      "Part8 Fresh Current Result",
    );

    await oldQueryRoute!.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(searchPayload("Part8 Old Stale Result")),
    });
    await expect(page.locator("body")).not.toContainText(
      "Part8 Old Stale Result",
    );

    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");
    await expect(page.locator("body")).not.toContainText(
      "Part8 Old Stale Result",
    );
  });
});

function searchPayload(title: string) {
  return {
    mode: "hybrid",
    total: 1,
    facets: [],
    debug: {
      indexAlias: "part8-test",
      normalized: true,
      aclApplied: true,
    },
    results: [
      {
        rank: 1,
        score: 1,
        scoreComponents: {
          lexical: 1,
          semantic: 0,
          combined: 1,
        },
        source: {
          id: "00000000-0000-4000-8000-000000014101",
          workspaceId: null,
          documentId: null,
          provider: {
            id: "provider_part8",
            code: "part8",
            name: "Part8 Provider",
            providerType: "public",
            jurisdiction: "ru",
            accessMode: "api",
            isEnabled: true,
          },
          sourceType: "court_decision",
          jurisdiction: "ru",
          title,
          canonicalUrl: null,
          externalId: null,
          licenseStatus: "allowed",
          visibility: "public",
          classification: "public",
          status: "indexed",
          ownerWorkspaceId: null,
          ownerUserId: null,
          court: "Part8 Court",
          caseNumber: "PART8-1",
          decisionDate: "2026-05-14",
          hasEmbeddings: true,
          indexedAt: "2026-05-14T00:00:00.000Z",
          lastUsedAt: null,
          createdAt: "2026-05-14T00:00:00.000Z",
          updatedAt: "2026-05-14T00:00:00.000Z",
        },
        chunk: {
          id: "chunk_part8_1",
          sourceId: "00000000-0000-4000-8000-000000014101",
          documentVersionId: "docv_part8_1",
          chunkNo: 1,
          chunkType: "paragraph",
          text: `${title} snippet body`,
          textHash: "sha256:part8",
          pageFrom: 1,
          pageTo: 1,
          charStart: 0,
          charEnd: 20,
          metadata: {},
          securityScope: "public",
          embeddingModel: "part8",
          embeddingHash: "sha256:embedding",
          indexedAt: "2026-05-14T00:00:00.000Z",
        },
        snippet: `${title} snippet body`,
        highlights: [],
        citation: {
          citationId: "cit_part8",
          sourceId: "00000000-0000-4000-8000-000000014101",
          chunkId: "chunk_part8_1",
          documentVersionId: "docv_part8_1",
          title,
          quote: `${title} snippet body`,
          pageFrom: 1,
          pageTo: 1,
          court: "Part8 Court",
          caseNumber: "PART8-1",
          decisionDate: "2026-05-14",
          score: 1,
        },
      },
    ],
  };
}
