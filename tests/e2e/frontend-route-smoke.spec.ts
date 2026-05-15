import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady, type RouteKind } from "./utils/navigation";
import {
  assertBodyNotScrollableWhenRouteRequiresHScreen,
  assertNoDuplicateShellComposers,
  assertNoOldProjectDashboard,
} from "./utils/visual-invariants";

const projectId = "project_claim_001";
const seededProjectChatId = "chat_project_claim_001";

test.describe("@block2 frontend route smoke", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block2-route-${Date.now()}@lexframe.local`,
      fullName: "Block2 Route Smoke",
    });
  });

  for (const route of [
    { path: "/app/projects", kind: "ordinary" as RouteKind },
    { path: `/app/projects/${projectId}`, kind: "project-workspace" as RouteKind },
    { path: `/app/projects/${projectId}/chats`, kind: "project-chat" as RouteKind },
    {
      path: `/app/projects/${projectId}/chats/${seededProjectChatId}`,
      kind: "project-chat" as RouteKind,
    },
    { path: "/chat", kind: "global-chat" as RouteKind },
    { path: "/documents", kind: "documents" as RouteKind },
    { path: "/sources", kind: "sources" as RouteKind },
    { path: `/app/projects/${projectId}/automations`, kind: "automations" as RouteKind },
  ]) {
    test(`opens ${route.path} without shell regressions`, async ({ page }) => {
      await page.goto(route.path);
      await assertRouteReady(page, route.kind);
      await assertNoHydrationErrors(page);
      await assertNoConsoleErrors(page, [/Failed to load resource/i]);
      await assertNoBlockingOverlay(page);
      await assertNoDuplicateShellComposers(page);

      if (route.kind === "project-workspace") {
        await assertNoOldProjectDashboard(page);
        await expect(page.getByRole("tab", { name: "Чаты" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Источники" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Автоматизации" })).toBeVisible();
      }

      if (route.kind === "project-chat" || route.kind === "global-chat") {
        await expect(page.getByTestId("floating-ai-composer")).toHaveCount(0);
        await assertBodyNotScrollableWhenRouteRequiresHScreen(page);
      }
    });
  }

  test("opens a created global chat route without leaking project chat UI", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const response = await request.post(`${session.apiBaseUrl}/chat/threads`, {
      headers: {
        ...session.headers,
        "content-type": "application/json",
      },
      data: {
        kind: "general",
        title: "Block2 global route smoke",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const payload = (await response.json()) as {
      readonly thread: { readonly id: string };
    };

    await page.goto(`/chat/${payload.thread.id}`);
    await assertRouteReady(page, "global-chat");
    await expect(page.getByTestId("floating-ai-composer")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Проектный чат");
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});
