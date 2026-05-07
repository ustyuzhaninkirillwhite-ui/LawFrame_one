import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

test.describe("Stage 10 dashboard live smoke", () => {
  test("dashboard snapshot and event feed load from the live backend", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `dashboard-${Date.now()}@lexframe.local`,
      fullName: "Dashboard Owner",
    });

    const api = await getWorkspaceApiSession(page, request);

    const snapshotResponse = await request.get(
      `${api.apiBaseUrl}/dashboard/snapshot`,
      {
        headers: api.headers,
      },
    );
    expect(snapshotResponse.ok()).toBeTruthy();

    const snapshot = (await snapshotResponse.json()) as {
      readonly activeRuns: readonly unknown[];
      readonly pendingApprovals: readonly unknown[];
      readonly recommendations: readonly unknown[];
      readonly recentArtifacts: readonly unknown[];
      readonly failedRuns: readonly unknown[];
      readonly unreadNotificationsCount: number;
      readonly systemStatus: {
        readonly overall: string;
      };
    };

    expect(Array.isArray(snapshot.activeRuns)).toBeTruthy();
    expect(Array.isArray(snapshot.pendingApprovals)).toBeTruthy();
    expect(Array.isArray(snapshot.recommendations)).toBeTruthy();
    expect(Array.isArray(snapshot.recentArtifacts)).toBeTruthy();
    expect(Array.isArray(snapshot.failedRuns)).toBeTruthy();
    expect(typeof snapshot.unreadNotificationsCount).toBe("number");
    expect(typeof snapshot.systemStatus?.overall).toBe("string");

    const eventsResponse = await request.get(
      `${api.apiBaseUrl}/dashboard/events`,
      {
        headers: api.headers,
      },
    );
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsPayload = (await eventsResponse.json()) as {
      readonly events: readonly unknown[];
    };
    expect(Array.isArray(eventsPayload.events)).toBeTruthy();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('a[href^="/app/projects/"]').first()).toBeVisible();
  });
});
