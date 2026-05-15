import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const foreignWorkspaceId = "00000000-0000-4000-8000-000000019999";
const foreignSourceId = "00000000-0000-4000-8000-000000014103";

test.describe("@part8 search cross-workspace scope", () => {
  test("wrong workspace header and foreign source selection do not return source data", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `part8-search-scope-${Date.now()}@lexframe.local`,
      fullName: "Part8 Search Scope",
    });
    const session = await getWorkspaceApiSession(page, request);
    const jsonHeaders = {
      ...session.headers,
      "content-type": "application/json",
    };

    const spoofedWorkspaceResponse = await request.post(
      `${session.apiBaseUrl}/legal-search/query`,
      {
        headers: {
          ...jsonHeaders,
          "x-workspace-id": foreignWorkspaceId,
        },
        data: {
          query: "Stage14 estoppel",
          mode: "hybrid",
          limit: 5,
        },
      },
    );
    expect(spoofedWorkspaceResponse.status()).toBeGreaterThanOrEqual(400);
    expect(spoofedWorkspaceResponse.status()).toBeLessThan(500);
    expect(await spoofedWorkspaceResponse.text()).not.toMatch(
      /Stage14 Public Estoppel Decision|Stage14 Product Private Arbitration Note/i,
    );

    const foreignSourceResponse = await request.post(
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
    expect(foreignSourceResponse.ok(), await foreignSourceResponse.text()).toBeTruthy();
    const foreignSearch = (await foreignSourceResponse.json()) as {
      readonly total: number;
      readonly results: readonly unknown[];
    };
    expect(foreignSearch.total).toBe(0);
    expect(foreignSearch.results).toHaveLength(0);
  });
});
