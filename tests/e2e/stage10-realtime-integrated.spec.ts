import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import {
  installAndSyncFirstAutomation,
  runDeliveryDemoFlow,
} from "./helpers/activepieces-demo";
import { signInAsDemo } from "./helpers/auth";
import { expectReadinessProfile } from "./helpers/readiness";

interface DashboardSnapshotResponse {
  readonly snapshotVersion: number;
  readonly unreadNotificationsCount: number;
  readonly recentArtifacts: readonly {
    readonly id: string;
  }[];
}

interface DashboardEventsResponse {
  readonly snapshotVersion: number;
  readonly events: readonly {
    readonly topic: string;
    readonly eventType: string;
    readonly entityId: string;
  }[];
}

test.describe("Stage 10 realtime integrated demo", () => {
  test("dashboard events and snapshot reflect the delivery demo contour", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `realtime-integrated-${Date.now()}@lexframe.local`,
      fullName: "Stage10 Realtime Integrated",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    const session = await getWorkspaceApiSession(page, request);

    const initialSnapshotResponse = await request.get(
      `${session.apiBaseUrl}/dashboard/snapshot`,
      {
        headers: session.headers,
      },
    );
    expect(initialSnapshotResponse.ok()).toBeTruthy();
    const initialSnapshot =
      (await initialSnapshotResponse.json()) as DashboardSnapshotResponse;

    const automationId = await installAndSyncFirstAutomation(request, session);
    const result = await runDeliveryDemoFlow(request, session, automationId);

    const eventsResponse = await request.get(
      `${session.apiBaseUrl}/dashboard/events?since_sequence=${initialSnapshot.snapshotVersion}`,
      {
        headers: session.headers,
      },
    );
    expect(eventsResponse.ok()).toBeTruthy();
    const eventsPayload =
      (await eventsResponse.json()) as DashboardEventsResponse;
    const eventTypes = eventsPayload.events.map((event) => event.eventType);

    expect(eventTypes).toContain("run.created");
    expect(eventTypes).toContain("delivery.status.updated");
    expect(eventTypes).toContain("notification.created");
    expect(
      eventsPayload.events.some(
        (event) =>
          event.topic === `workspace:${session.workspaceId}:dashboard` &&
          event.entityId === result.smoke.runId,
      ),
    ).toBeTruthy();

    const refreshedSnapshotResponse = await request.get(
      `${session.apiBaseUrl}/dashboard/snapshot`,
      {
        headers: session.headers,
      },
    );
    expect(refreshedSnapshotResponse.ok()).toBeTruthy();
    const refreshedSnapshot =
      (await refreshedSnapshotResponse.json()) as DashboardSnapshotResponse;

    expect(refreshedSnapshot.snapshotVersion).toBeGreaterThan(
      initialSnapshot.snapshotVersion,
    );
    expect(refreshedSnapshot.unreadNotificationsCount).toBeGreaterThanOrEqual(
      initialSnapshot.unreadNotificationsCount,
    );
    expect(
      refreshedSnapshot.recentArtifacts.some(
        (artifact) => artifact.id === result.smoke.artifactIds[0],
      ),
    ).toBeTruthy();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("main")).toBeVisible();
  });
});
