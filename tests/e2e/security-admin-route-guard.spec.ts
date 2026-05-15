import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

test.describe("@part7 security admin route guard", () => {
  test("viewer cannot open admin/security routes or call privileged admin APIs directly", async ({
    browser,
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const viewerEmail = `part7-viewer-${runId}@lexframe.local`;

    await signInAsDemo(page, {
      email: `part7-admin-owner-${runId}@lexframe.local`,
      fullName: "Part7 Admin Owner",
    });
    const ownerSession = await getWorkspaceApiSession(page, request);

    const invitationResponse = await request.post(
      `${ownerSession.apiBaseUrl}/workspaces/${ownerSession.workspaceId}/invitations`,
      {
        headers: ownerSession.headers,
        data: {
          email: viewerEmail,
          role: "viewer",
        },
      },
    );
    expect(invitationResponse.ok()).toBeTruthy();
    const invitation = (await invitationResponse.json()) as {
      readonly deliveryPreview?: { readonly acceptUrl?: string };
    };
    const acceptUrl = invitation.deliveryPreview?.acceptUrl;
    expect(acceptUrl).toBeTruthy();

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signInAsDemo(
      viewerPage,
      {
        email: viewerEmail,
        fullName: "Part7 Viewer",
      },
      { createWorkspaceIfNeeded: false },
    );
    await viewerPage.goto(acceptUrl ?? "/sign-in");
    await expect(viewerPage).toHaveURL(/\/invite\//);
    await viewerPage.locator("main button").last().click();
    await expect(viewerPage).toHaveURL(/\/dashboard$/);
    const viewerSession = await getWorkspaceApiSession(viewerPage, request);

    const adminApiPaths = [
      "/audit/events",
      "/admin/security/audit-events",
      "/admin/security/secrets",
      "/admin/security/alerts",
      "/admin/security/incidents",
    ];
    for (const path of adminApiPaths) {
      const response = await request.get(`${viewerSession.apiBaseUrl}${path}`, {
        headers: viewerSession.headers,
      });
      expect(response.status(), path).toBe(403);
      const text = await response.text();
      expect(text).not.toMatch(/secret_ref_id|Authorization: Bearer|BEGIN PRIVATE KEY|service_role/i);
    }

    await viewerPage.goto("/admin/security");
    await expect(
      viewerPage.getByRole("heading", {
        name: "Security overview and release gates",
      }),
    ).toHaveCount(0);
    await expect(viewerPage.locator('a[href="/admin/security"]')).toHaveCount(0);

    await testInfo.attach("admin-route-guard-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            viewerWorkspaceId: viewerSession.workspaceId,
            deniedAdminApiPaths: adminApiPaths,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
    await viewerContext.close();
  });
});
