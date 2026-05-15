import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import { installConsoleGuards } from "./utils/console";

test.describe("@part6 settings multitab route consistency", () => {
  test("saving chat route in one tab and automation route in another does not overwrite either preference", async ({
    context,
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const chatModel = `part6-tab-chat-${runId}`;
    const automationModel = `part6-tab-automation-${runId}`;
    installConsoleGuards(page);

    await signInAsDemo(page, {
      email: `part6-multitab-${runId}@lexframe.local`,
      fullName: "Part6 Multitab",
    });
    const session = await getWorkspaceApiSession(page, request);
    const secondPage = await context.newPage();
    installConsoleGuards(secondPage);

    await openAiSettings(page);
    await openAiSettings(secondPage);

    await page.getByTestId("settings-ai-model-id-chat_ai").fill(chatModel);
    await page
      .getByTestId("settings-ai-api-key-chat_ai")
      .fill(`sk-part6-tab-chat-${runId}-secret`);
    await secondPage
      .getByTestId("settings-ai-model-id-automation_ai")
      .fill(automationModel);
    await secondPage
      .getByTestId("settings-ai-api-key-automation_ai")
      .fill(`sk-part6-tab-automation-${runId}-secret`);

    await Promise.all([
      saveRouteCard(page, "chat_ai"),
      saveRouteCard(secondPage, "automation_ai"),
    ]);

    const response = await request.get(`${session.apiBaseUrl}/settings/ai`, {
      headers: session.headers,
    });
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      routeGroups: Array<{ routeGroup: string; modelId: string | null }>;
    };
    expect(body.routeGroups.find((item) => item.routeGroup === "chat_ai")).toMatchObject({
      modelId: chatModel,
    });
    expect(
      body.routeGroups.find((item) => item.routeGroup === "automation_ai"),
    ).toMatchObject({
      modelId: automationModel,
    });
    await secondPage.close();
    await testInfo.attach("settings-multitab-summary", {
      body: Buffer.from(
        `${JSON.stringify({ chatModel, automationModel }, null, 2)}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});

async function openAiSettings(page: import("@playwright/test").Page) {
  await page.goto("/app/projects");
  await page.getByTestId("settings-entry-point").click();
  await page.getByTestId("settings-tab-ai").click();
  await expect(page.getByTestId("settings-ai-route-card-chat_ai")).toBeVisible();
}

async function saveRouteCard(
  page: import("@playwright/test").Page,
  routeGroup: "chat_ai" | "automation_ai",
) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(`/settings/ai/route-groups/${routeGroup}`) &&
      candidate.request().method() === "PATCH" &&
      candidate.ok(),
  );
  await page.getByTestId(`settings-ai-save-${routeGroup}`).click();
  await response;
}
