import { expect, test, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { ensureAutomationCanvas } from "./utils/automation";
import {
  assertMainReceivesPointerEvents,
  assertNoForbiddenBrowserRequests,
  assertNoSecretLikeStringsInDomAndStorage,
  collectNetworkSummary,
  installNetworkSummary,
  waitForRouteSettled,
  waitForShellReady,
} from "./utils/shell-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block1 shell navigation state", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSummary(page);
    await signInAsDemo(page, {
      email: `block1-shell-${Date.now()}@lexframe.local`,
      fullName: "Block1 Shell",
    });
    await waitForShellReady(page);
  });

  test("keeps shell mode correct across project, chat and automation route families", async ({
    page,
    request,
  }, testInfo) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const routes = [
      {
        path: "/app/projects",
        kind: "ordinary" as const,
        shellMode: "panel",
        routeMode: "panel",
        composer: "visible",
      },
      {
        path: `/app/projects/${projectId}`,
        kind: "project-workspace" as const,
        shellMode: "immersive",
        routeMode: "project-workspace",
        composer: "hidden",
      },
      {
        path: "/chat",
        kind: "global-chat" as const,
        shellMode: "immersive",
        routeMode: "global-chat",
        composer: "hidden",
      },
      {
        path: `/app/projects/${projectId}/chats`,
        kind: "project-chat" as const,
        shellMode: "immersive",
        routeMode: "project-chat",
        composer: "hidden",
      },
      {
        path: `/app/projects/${projectId}/automations`,
        kind: "automations" as const,
        shellMode: "panel",
        routeMode: "panel",
        composer: "visible",
      },
      {
        path: canvas.route,
        kind: "automation-canvas" as const,
        shellMode: "canvas",
        routeMode: "automation-canvas",
        composer: "hidden",
      },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await assertRouteReady(page, route.kind);
      await expect(page.getByTestId("app-shell-root")).toHaveAttribute(
        "data-shell-mode",
        route.shellMode,
      );
      await expect(page.getByTestId("app-shell-main")).toHaveAttribute(
        "data-route-mode",
        route.routeMode,
      );
      if (route.composer === "hidden") {
        await expect(page.getByTestId("floating-ai-composer")).toHaveCount(0);
      } else {
        await expect(page.getByTestId("floating-ai-composer")).toHaveCount(1);
      }
      await expect(page.getByTestId("project-sidebar")).toBeVisible();
      await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
        "data-active-project-id",
        projectId,
      );
      await waitForRouteSettled(page);
      await assertNoBlockingOverlay(page);
      await assertMainReceivesPointerEvents(page);
    }

    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoForbiddenBrowserRequests(page);
    await assertNoSecretLikeStringsInDomAndStorage(page);
    await attachJson(testInfo, "shell-navigation-network-summary", {
      summary: await collectNetworkSummary(page),
    });
  });

  test("keeps the final route DOM after rapid route switching", async ({
    page,
  }, testInfo) => {
    const finalPath = `/app/projects/${projectId}`;
    await Promise.allSettled([
      page.goto("/chat", { waitUntil: "commit" }),
      page.goto("/app/projects", { waitUntil: "commit" }),
      page.goto(finalPath, { waitUntil: "commit" }),
    ]);

    if (new URL(page.url()).pathname !== finalPath) {
      await page.goto(finalPath, { waitUntil: "domcontentloaded" });
    }

    await assertRouteReady(page, "project-workspace");
    await expect(page).toHaveURL(new RegExp(`${finalPath}$`));
    await expect(page.getByTestId("app-shell-main")).toHaveAttribute(
      "data-route-mode",
      "project-workspace",
    );
    await expect(page.getByTestId("floating-ai-composer")).toHaveCount(0);
    await assertNoBlockingOverlay(page);
    await assertMainReceivesPointerEvents(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "rapid-route-switch-network-summary", {
      summary: await collectNetworkSummary(page),
    });
  });
});

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
