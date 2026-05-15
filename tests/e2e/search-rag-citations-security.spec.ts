import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const foreignSourceId = "00000000-0000-4000-8000-000000014103";
const forbiddenPattern =
  /(OPENAI_API_KEY|TAVILY_API_KEY|service_role|Authorization:\s*Bearer|\/storage\/v1\/object\/sign\/|[?&]token=|sk-[A-Za-z0-9_-]{12,})/i;

test.describe("@part8 search RAG citations security", () => {
  test("RAG citations resolve to allowed search sources and legal-search audit redacts raw query text", async ({
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const rawAuditQuery = `part8 confidential search audit marker ${runId}`;
    await signInAsDemo(page, {
      email: `part8-rag-citations-${runId}@lexframe.local`,
      fullName: "Part8 RAG Citations",
    });
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };

    const searchResponse = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers,
        data: {
          query: "Stage14 estoppel",
          mode: "hybrid",
          limit: 5,
        },
      },
    );
    expect(searchResponse.ok(), await searchResponse.text()).toBeTruthy();
    const searchText = await searchResponse.text();
    expect(searchText).not.toMatch(forbiddenPattern);
    const search = JSON.parse(searchText) as LegalSearchResponse;
    expect(search.results.length).toBeGreaterThan(0);

    const allowedSources = new Set(search.results.map((result) => result.source.id));
    for (const result of search.results) {
      expect(result.citation.sourceId).toBe(result.source.id);
      expect(result.citation.chunkId).toBe(result.chunk.id);
      expect(result.citation.title).toBe(result.source.title);
      expect(result.source.id).not.toBe(foreignSourceId);
    }

    const ragResponse = await request.post(
      `${session.apiBaseUrl}/legal-rag/analyze`,
      {
        headers,
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
    expect(ragResponse.ok(), await ragResponse.text()).toBeTruthy();
    const ragText = await ragResponse.text();
    expect(ragText).not.toMatch(forbiddenPattern);
    const rag = JSON.parse(ragText) as RagResponse;
    expect(rag.status).toBe("completed");
    expect(rag.output?.citations?.length ?? 0).toBeGreaterThan(0);
    for (const citation of rag.output?.citations ?? []) {
      expect(allowedSources.has(citation.sourceId)).toBe(true);
      expect(citation.sourceId).not.toBe(foreignSourceId);
      expect(citation.chunkId).toBeTruthy();
    }

    const auditProbe = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers,
        data: {
          query: rawAuditQuery,
          mode: "hybrid",
          limit: 1,
        },
      },
    );
    expect(auditProbe.ok(), await auditProbe.text()).toBeTruthy();

    const auditResponse = await request.get(`${session.apiBaseUrl}/audit/events`, {
      headers: session.headers,
    });
    expect(auditResponse.ok(), await auditResponse.text()).toBeTruthy();
    const auditText = await auditResponse.text();
    expect(auditText).not.toContain(rawAuditQuery);
    expect(auditText).not.toMatch(forbiddenPattern);
    const audit = JSON.parse(auditText) as unknown;
    const items: readonly AuditItem[] = Array.isArray(audit)
      ? audit
      : ((audit as { readonly items?: readonly AuditItem[] }).items ?? []);
    const searchEvents = items.filter(
      (item: AuditItem) => item.action === "legal.search.performed",
    );
    expect(searchEvents.length).toBeGreaterThan(0);
    expect(JSON.stringify(searchEvents)).toContain("queryHash");
    expect(JSON.stringify(searchEvents)).not.toContain('"query":');

    await testInfo.attach("part8-search-rag-citations-security", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            searchResults: search.results.length,
            ragCitations: rag.output?.citations?.length ?? 0,
            searchAuditEvents: searchEvents.length,
            rawAuditQueryPresent: false,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});

interface LegalSearchResponse {
  readonly results: Array<{
    readonly source: { readonly id: string; readonly title: string };
    readonly chunk: { readonly id: string };
    readonly citation: {
      readonly sourceId: string;
      readonly chunkId: string;
      readonly title: string;
    };
  }>;
}

interface RagResponse {
  readonly status: string;
  readonly output?: {
    readonly citations?: Array<{
      readonly sourceId: string;
      readonly chunkId: string;
    }>;
  };
}

interface AuditItem {
  readonly action: string;
  readonly metadata: unknown;
}
