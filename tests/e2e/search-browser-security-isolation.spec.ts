import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import {
  assertNoProjectFlowSecurityLeaks,
  installNetworkSecurityAssertions,
} from "./utils/network-assertions";
import { readBrowserStorage } from "./utils/storage";

const directSearchRuntimePattern =
  /(api\.tavily\.com|tavily\.com|127\.0\.0\.1:9200|localhost:9200|opensearch|api\.openai\.com|api\.anthropic\.com|api\.cometapi\.com|api\.x\.ai|api\.deepseek\.com)/i;
const forbiddenBrowserPattern =
  /(TAVILY_API_KEY|OPENAI_API_KEY|service_role|SUPABASE_SERVICE_ROLE|Authorization:\s*Bearer|\/storage\/v1\/object\/sign\/|[?&]token=|sk-[A-Za-z0-9_-]{12,})/i;

test.describe("@part8 search browser security isolation", () => {
  test("legal search UI routes through LexFrame backend without browser search/provider calls or storage leaks", async ({
    page,
  }, testInfo) => {
    const directRuntimeCalls: string[] = [];
    const legalSearchRequests: string[] = [];
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    page.on("request", (request) => {
      const url = request.url();
      if (directSearchRuntimePattern.test(url)) {
        directRuntimeCalls.push(url);
      }
      if (url.includes("/legal-search/query")) {
        legalSearchRequests.push(`${request.method()} ${new URL(url).pathname}`);
      }
    });

    await signInAsDemo(page, {
      email: `part8-search-browser-${Date.now()}@lexframe.local`,
      fullName: "Part8 Search Browser",
    });
    await page.goto("/research");
    await assertRouteReady(page, "ordinary");

    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/legal-search/query") && response.status() < 500,
    );
    await page
      .getByTestId("legal-search-query-input")
      .fill("Stage14 estoppel");
    await searchResponse;
    await expect(page.locator("body")).toContainText(
      /Stage14 Public Estoppel Decision/i,
      { timeout: 20_000 },
    );

    const domText = await page.locator("body").innerText();
    const storage = JSON.stringify(await readBrowserStorage(page));
    expect(legalSearchRequests).toContain("POST /legal-search/query");
    expect(directRuntimeCalls).toEqual([]);
    expect(domText).not.toMatch(forbiddenBrowserPattern);
    expect(storage).not.toMatch(forbiddenBrowserPattern);
    await assertNoProjectFlowSecurityLeaks(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page);

    await testInfo.attach("part8-search-browser-security-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            legalSearchRequests,
            directRuntimeCalls,
            domSecretLikeMatches: false,
            storageSecretLikeMatches: false,
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
