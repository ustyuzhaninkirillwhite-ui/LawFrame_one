import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

test.describe("@part7 security cross-workspace data leakage", () => {
  test("workspace header spoofing and route mismatches do not expose foreign projects", async ({
    browser,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const pageA = await (await browser.newContext()).newPage();
    await signInAsDemo(pageA, {
      email: `part7-ws-a-${runId}@lexframe.local`,
      fullName: "Part7 Workspace A",
    });
    const sessionA = await getWorkspaceApiSession(pageA, request);
    const projectAName = `Part7 Workspace A Project ${runId}`;
    const projectAResponse = await request.post(`${sessionA.apiBaseUrl}/projects`, {
      headers: sessionA.headers,
      data: { name: projectAName, description: "A", color: "#3B82F6" },
    });
    expect(projectAResponse.ok()).toBeTruthy();

    const pageB = await (await browser.newContext()).newPage();
    await signInAsDemo(pageB, {
      email: `part7-ws-b-${runId}@lexframe.local`,
      fullName: "Part7 Workspace B",
    });
    const sessionB = await getWorkspaceApiSession(pageB, request);
    const projectBName = `Part7 Workspace B Project ${runId}`;
    const projectBResponse = await request.post(`${sessionB.apiBaseUrl}/projects`, {
      headers: sessionB.headers,
      data: { name: projectBName, description: "B", color: "#3B82F6" },
    });
    expect(projectBResponse.ok()).toBeTruthy();

    const bList = await request.get(`${sessionB.apiBaseUrl}/projects`, {
      headers: sessionB.headers,
    });
    expect(bList.ok()).toBeTruthy();
    const bListText = await bList.text();
    expect(bListText).toContain(projectBName);
    expect(bListText).not.toContain(projectAName);

    const bSpoofsA = await request.get(`${sessionB.apiBaseUrl}/projects`, {
      headers: {
        authorization: sessionB.headers.authorization,
        "x-workspace-id": sessionA.workspaceId,
      },
    });
    expect(bSpoofsA.status()).toBe(403);
    expect(await bSpoofsA.text()).not.toContain(projectAName);

    const aSpoofsB = await request.get(`${sessionA.apiBaseUrl}/projects`, {
      headers: {
        authorization: sessionA.headers.authorization,
        "x-workspace-id": sessionB.workspaceId,
      },
    });
    expect(aSpoofsB.status()).toBe(403);
    expect(await aSpoofsB.text()).not.toContain(projectBName);

    await testInfo.attach("cross-workspace-data-leakage-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            workspaceA: sessionA.workspaceId,
            workspaceB: sessionB.workspaceId,
            bListContainsOnlyOwnProject: true,
            spoofedHeadersDenied: 2,
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
