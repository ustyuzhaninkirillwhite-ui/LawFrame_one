import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { installConsoleGuards } from "./utils/console";

test.describe("@part7 security forced route access", () => {
  test("forced project, project chat and document URLs from another workspace do not leak data", async ({
    browser,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    installConsoleGuards(ownerPage);
    await signInAsDemo(ownerPage, {
      email: `part7-owner-${runId}@lexframe.local`,
      fullName: "Part7 Owner",
    });
    const ownerSession = await getWorkspaceApiSession(ownerPage, request);
    const projectName = `Part7 Secret Project ${runId}`;
    const chatTitle = `Part7 Secret Chat ${runId}`;
    const documentTitle = `Part7 Secret Document ${runId}`;

    const projectResponse = await request.post(`${ownerSession.apiBaseUrl}/projects`, {
      headers: ownerSession.headers,
      data: {
        name: projectName,
        description: "Cross-workspace forced route marker",
        color: "#3B82F6",
      },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const project = (await projectResponse.json()) as {
      readonly project: { readonly id: string };
    };

    const projectChatResponse = await request.post(
      `${ownerSession.apiBaseUrl}/projects/${project.project.id}/chats`,
      {
        headers: ownerSession.headers,
        data: {
          title: chatTitle,
          source: "project_chat",
        },
      },
    );
    expect(projectChatResponse.ok()).toBeTruthy();
    const projectChat = (await projectChatResponse.json()) as {
      readonly session: { readonly id: string };
    };

    const documentResponse = await request.post(
      `${ownerSession.apiBaseUrl}/documents/upload-intents`,
      {
        headers: ownerSession.headers,
        data: {
          title: documentTitle,
          kind: "case_material",
          classification: "confidential",
          originalFilename: `part7-${runId}.txt`,
          mimeType: "text/plain",
          sizeBytes: 18,
        },
      },
    );
    const documentSetup = {
      status: documentResponse.status(),
      checked: documentResponse.ok(),
      documentId: null as string | null,
    };
    if (documentResponse.ok()) {
      const document = (await documentResponse.json()) as {
        readonly documentId: string;
      };
      documentSetup.documentId = document.documentId;
    }

    const attackerContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();
    installConsoleGuards(attackerPage);
    await signInAsDemo(attackerPage, {
      email: `part7-attacker-${runId}@lexframe.local`,
      fullName: "Part7 Attacker",
    });
    const attackerSession = await getWorkspaceApiSession(attackerPage, request);

    const blockedApiChecks = [
      `${attackerSession.apiBaseUrl}/projects/${project.project.id}`,
      `${attackerSession.apiBaseUrl}/chat/threads/${projectChat.session.id}`,
    ];
    if (documentSetup.documentId) {
      blockedApiChecks.push(
        `${attackerSession.apiBaseUrl}/documents/${documentSetup.documentId}`,
      );
    }

    for (const url of blockedApiChecks) {
      const response = await request.get(url, {
        headers: attackerSession.headers,
      });
      expect([403, 404]).toContain(response.status());
      const text = await response.text();
      expect(text).not.toContain(projectName);
      expect(text).not.toContain(chatTitle);
      expect(text).not.toContain(documentTitle);
    }

    await attackerPage.goto(`/app/projects/${project.project.id}`);
    await expect(attackerPage.locator("body")).toBeVisible();
    await attackerPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    const forcedProjectDom = await attackerPage.locator("body").innerText();
    expect(forcedProjectDom).not.toContain(projectName);
    expect(forcedProjectDom).not.toContain(chatTitle);

    await attackerPage.goto(`/app/projects/${project.project.id}/chats/${projectChat.session.id}`);
    await expect(attackerPage.locator("body")).toBeVisible();
    await attackerPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    const forcedChatDom = await attackerPage.locator("body").innerText();
    expect(forcedChatDom).not.toContain(projectName);
    expect(forcedChatDom).not.toContain(chatTitle);

    await testInfo.attach("forced-route-access-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            ownerWorkspaceId: ownerSession.workspaceId,
            attackerWorkspaceId: attackerSession.workspaceId,
            blockedApiChecks: blockedApiChecks.length,
            documentSetup,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });

    await attackerContext.close();
    await ownerContext.close();
  });
});
