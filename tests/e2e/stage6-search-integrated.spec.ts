import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { expectReadinessProfile } from "./helpers/readiness";

const publicSourceId = "00000000-0000-4000-8000-000000014101";
const productPrivateSourceId = "00000000-0000-4000-8000-000000014102";
const foreignSourceId = "00000000-0000-4000-8000-000000014103";

test.describe("Stage 6 search/RAG integrated smoke", () => {
  test("indexes searchable sources, returns citations, and enforces source ACL", async ({
    page,
    request,
  }) => {
    const directSearchRequests: string[] = [];
    page.on("request", (browserRequest) => {
      const url = browserRequest.url().toLowerCase();

      if (url.includes(":9200") || url.includes("opensearch")) {
        directSearchRequests.push(browserRequest.url());
      }
    });

    await signInAsDemo(page, {
      email: `stage6-search-${Date.now()}@lexframe.local`,
      fullName: "Stage6 Search Integrated",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    expect(directSearchRequests).toEqual([]);

    const session = await getWorkspaceApiSession(page, request);
    const jsonHeaders = {
      ...session.headers,
      "content-type": "application/json",
    };

    const publicSearchResponse = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers: jsonHeaders,
        data: {
          query: "Stage14 estoppel",
          mode: "hybrid",
          limit: 5,
        },
      },
    );
    expect(publicSearchResponse.ok()).toBeTruthy();
    const publicSearch = (await publicSearchResponse.json()) as {
      readonly total: number;
      readonly results: Array<{
        readonly source: { readonly id: string; readonly title: string };
        readonly citation: {
          readonly sourceId: string;
          readonly chunkId: string;
        };
      }>;
      readonly debug?: {
        readonly indexAlias?: string;
        readonly aclApplied?: boolean;
      };
    };

    expect(publicSearch.total).toBeGreaterThan(0);
    expect(publicSearch.debug?.indexAlias).toBeTruthy();
    expect(publicSearch.debug?.aclApplied).toBe(true);
    expect(publicSearch.results[0]?.source.id).toBe(publicSourceId);
    expect(publicSearch.results[0]?.citation.sourceId).toBe(publicSourceId);
    expect(publicSearch.results[0]?.citation.chunkId).toBeTruthy();
    expect(
      publicSearch.results.some(
        (result) => result.source.id === foreignSourceId,
      ),
    ).toBe(false);

    const productPrivateSearchResponse = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers: jsonHeaders,
        data: {
          query: "Stage14 private arbitration",
          mode: "hybrid",
          selectedSourceIds: [productPrivateSourceId],
          limit: 3,
        },
      },
    );
    expect(productPrivateSearchResponse.ok()).toBeTruthy();
    const productPrivateSearch =
      (await productPrivateSearchResponse.json()) as typeof publicSearch;
    expect(productPrivateSearch.total).toBeGreaterThan(0);
    expect(productPrivateSearch.results[0]?.source.id).toBe(
      productPrivateSourceId,
    );

    const foreignSearchResponse = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers: jsonHeaders,
        data: {
          query: "foreign-only-stage14",
          mode: "hybrid",
          selectedSourceIds: [foreignSourceId],
          limit: 5,
        },
      },
    );
    expect(foreignSearchResponse.ok()).toBeTruthy();
    const foreignSearch =
      (await foreignSearchResponse.json()) as typeof publicSearch;
    expect(foreignSearch.total).toBe(0);
    expect(foreignSearch.results).toHaveLength(0);

    const ragResponse = await request.post(
      `${session.apiBaseUrl}/legal-rag/analyze`,
      {
        headers: jsonHeaders,
        data: {
          taskType: "legal_position_analysis",
          question: "Which Stage14 estoppel source supports citation use?",
          sourceSelection: {
            mode: "search_only",
            searchQuery: "Stage14 estoppel",
          },
          options: {
            maxContextChunks: 4,
            requireCitations: true,
            includeUnsupportedClaims: true,
          },
        },
      },
    );
    expect(ragResponse.ok()).toBeTruthy();
    const rag = (await ragResponse.json()) as {
      readonly status: string;
      readonly aiRoute: string;
      readonly output?: {
        readonly citations?: Array<{
          readonly sourceId: string;
          readonly chunkId: string;
        }>;
      };
    };

    expect(rag.status).toBe("completed");
    expect(rag.aiRoute).toBe("local_mock");
    expect(rag.output?.citations?.length ?? 0).toBeGreaterThan(0);
    expect(rag.output?.citations?.[0]?.sourceId).toBe(publicSourceId);
    expect(
      rag.output?.citations?.some(
        (citation) => citation.sourceId === foreignSourceId,
      ),
    ).toBe(false);
  });
});
