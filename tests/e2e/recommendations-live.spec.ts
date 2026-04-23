import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

test.describe("Stage 9 recommendations live smoke", () => {
  test("recommendation and analytics endpoints answer from the live backend", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `recommendations-${Date.now()}@lexframe.local`,
      fullName: "Recommendations Owner",
    });

    const api = await getWorkspaceApiSession(page, request);

    const recommendationsResponse = await request.get(
      `${api.apiBaseUrl}/recommendations`,
      {
        headers: api.headers,
      },
    );
    expect(recommendationsResponse.ok()).toBeTruthy();
    const recommendations = (await recommendationsResponse.json()) as
      | readonly unknown[]
      | {
          readonly message?: string;
        };
    expect(Array.isArray(recommendations)).toBeTruthy();

    const patternsResponse = await request.get(
      `${api.apiBaseUrl}/admin/recommendations/patterns`,
      {
        headers: api.headers,
      },
    );
    expect(patternsResponse.ok()).toBeTruthy();
    const patterns = (await patternsResponse.json()) as readonly unknown[];
    expect(Array.isArray(patterns)).toBeTruthy();

    const processCasesResponse = await request.get(
      `${api.apiBaseUrl}/admin/analytics/process-cases`,
      {
        headers: api.headers,
      },
    );
    expect(processCasesResponse.ok()).toBeTruthy();
    const processCases =
      (await processCasesResponse.json()) as readonly unknown[];
    expect(Array.isArray(processCases)).toBeTruthy();

    await page.goto("/recommendations");
    await expect(
      page.getByText(
        "Recommendations stay advisory-only until a human converts them into a workflow draft.",
      ),
    ).toBeVisible();

    if (Array.isArray(recommendations) && recommendations.length === 0) {
      await expect(page.getByText("No visible candidates")).toBeVisible();
    } else {
      await expect(page.getByText("Recommendation inbox")).toBeVisible();
    }

    await page.goto("/admin/recommendations");
    await expect(page.getByText("Pattern review")).toBeVisible();
    await expect(page.getByText("Case explorer")).toBeVisible();
  });
});
