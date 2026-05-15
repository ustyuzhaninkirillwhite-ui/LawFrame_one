import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

const apiBaseUrl = process.env.LEXFRAME_API_BASE_URL ?? `http://127.0.0.1:${process.env.LEXFRAME_API_PORT ?? "3104"}`;

test.describe("Stage 1 auth / workspace / RBAC smoke", () => {
  test("owner sees admin surfaces, viewer is restricted to workspace-safe navigation", async ({
    browser,
    page,
    request,
  }) => {
    const viewerEmail = `viewer-${Date.now()}@lexframe.local`;

    await signInAsDemo(page, {
      email: `owner-${Date.now()}@lexframe.local`,
      fullName: "Owner Stage1",
    });

    const ownerToken = await page.evaluate(() =>
      window.localStorage.getItem("lexframe.dev.access-token"),
    );
    expect(ownerToken).toBeTruthy();

    const sessionContextResponse = await request.get(`${apiBaseUrl}/session/context`, {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(sessionContextResponse.ok()).toBeTruthy();
    const sessionContext = (await sessionContextResponse.json()) as {
      readonly activeWorkspace: { readonly id: string } | null;
    };
    const workspaceId = sessionContext.activeWorkspace?.id;
    expect(workspaceId).toBeTruthy();

    const invitationResponse = await request.post(
      `${apiBaseUrl}/workspaces/${workspaceId}/invitations`,
      {
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-workspace-id": workspaceId ?? "",
        },
        data: {
          email: viewerEmail,
          role: "viewer",
        },
      },
    );
    expect(invitationResponse.ok()).toBeTruthy();
    const invitation = (await invitationResponse.json()) as {
      readonly deliveryPreview?: {
        readonly acceptUrl?: string;
      };
    };
    const acceptUrl = invitation.deliveryPreview?.acceptUrl;
    expect(acceptUrl).toBeTruthy();

    await page.goto("/admin/security");
    await expect(page).toHaveURL(/\/admin\/security$/);
    await expect(
      page.getByRole("heading", { name: "Security overview and release gates" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.locator("main")).toBeVisible();

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await signInAsDemo(viewerPage, {
      email: viewerEmail,
      fullName: "Viewer Stage1",
    }, {
      createWorkspaceIfNeeded: false,
    });
    await viewerPage.goto(acceptUrl ?? "/sign-in");
    await expect(viewerPage).toHaveURL(/\/invite\//);
    await viewerPage.locator("main button").last().click();
    await expect(viewerPage).toHaveURL(/\/dashboard$/);

    await expect(
      viewerPage.locator('a[href*="documents"], a[href$="#documents"]').first(),
    ).toBeVisible();
    await expect(viewerPage.locator('a[href="/admin/security"]')).toHaveCount(0);
    await viewerPage.goto("/admin/security");
    await expect(
      viewerPage.getByRole("heading", {
        name: "Security overview and release gates",
      }),
    ).toHaveCount(0);

    await viewerContext.close();
  });
});
