import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

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

    const sessionContextResponse = await request.get("http://127.0.0.1:3100/session/context", {
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
      `http://127.0.0.1:3100/workspaces/${workspaceId}/invitations`,
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

    await expect(page.getByRole("link", { name: "Admin / Security" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await signInAsDemo(viewerPage, {
      email: viewerEmail,
      fullName: "Viewer Stage1",
    }, {
      createWorkspaceIfNeeded: false,
    });
    await viewerPage.goto(acceptUrl ?? "/sign-in");
    await viewerPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(viewerPage).toHaveURL(/\/dashboard$/);

    await expect(viewerPage.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(
      viewerPage.getByRole("link", { name: "Admin / Security" }),
    ).toHaveCount(0);

    await viewerContext.close();
  });
});
