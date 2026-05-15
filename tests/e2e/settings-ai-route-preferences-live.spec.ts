import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  assertSettingsSecretNotExposed,
  installSettingsSecurityScan,
  settingsSecuritySnapshot,
} from "./utils/settings-security";

test.describe("@part6 settings AI route preferences", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("keeps chat and automation route preferences independent and backend-resolved", async ({
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const marker = `sk-part6-route-${runId}-write-only-secret`;
    const chatModel = `part6-chat-model-${runId}`;
    const automationModel = `part6-automation-model-${runId}`;
    installSettingsSecurityScan(page, marker);

    await signInAsDemo(page, {
      email: `part6-ai-route-${runId}@lexframe.local`,
      fullName: "Part6 AI Route",
    });
    const session = await getWorkspaceApiSession(page, request);
    await openAiSettings(page);

    await configureRouteCard(page, "chat_ai", {
      modelId: chatModel,
      apiKey: marker,
    });
    await saveRouteCard(page, "chat_ai");
    await expect(page.getByTestId("settings-ai-api-key-chat_ai")).toHaveCount(0);

    await configureRouteCard(page, "automation_ai", {
      modelId: automationModel,
      apiKey: `${marker}-automation`,
    });
    await saveRouteCard(page, "automation_ai");

    const aiSettingsResponse = await request.get(`${session.apiBaseUrl}/settings/ai`, {
      headers: session.headers,
    });
    expect(aiSettingsResponse.ok()).toBeTruthy();
    const aiSettings = (await aiSettingsResponse.json()) as {
      routeGroups: Array<{
        routeGroup: string;
        providerConnectionId: string | null;
        modelId: string | null;
      }>;
    };
    const chatPreference = aiSettings.routeGroups.find(
      (preference) => preference.routeGroup === "chat_ai",
    );
    const automationPreference = aiSettings.routeGroups.find(
      (preference) => preference.routeGroup === "automation_ai",
    );

    expect(chatPreference).toMatchObject({ modelId: chatModel });
    expect(automationPreference).toMatchObject({ modelId: automationModel });
    expect(chatPreference?.providerConnectionId).toBeTruthy();
    expect(automationPreference?.providerConnectionId).toBeTruthy();
    expect(chatPreference?.providerConnectionId).not.toBe(
      automationPreference?.providerConnectionId,
    );
    expect(JSON.stringify(aiSettings)).not.toContain(marker);

    const effectiveResponse = await request.get(
      `${session.apiBaseUrl}/settings/ai/effective-policy`,
      { headers: session.headers },
    );
    expect(effectiveResponse.ok()).toBeTruthy();
    const effective = (await effectiveResponse.json()) as {
      policies: Array<{ routeGroup: string; modelId: string; providerConnectionId: string }>;
    };
    expect(effective.policies.find((policy) => policy.routeGroup === "chat_ai")).toMatchObject({
      modelId: chatModel,
      providerConnectionId: chatPreference?.providerConnectionId,
    });
    expect(
      effective.policies.find((policy) => policy.routeGroup === "automation_ai"),
    ).toMatchObject({
      modelId: automationModel,
      providerConnectionId: automationPreference?.providerConnectionId,
    });
    expect(JSON.stringify(effective)).not.toContain(marker);

    await page.reload();
    await openAiSettings(page);
    await expect(page.getByTestId("settings-ai-model-id-chat_ai")).toHaveValue(
      chatModel,
    );
    await expect(page.getByTestId("settings-ai-model-id-automation_ai")).toHaveValue(
      automationModel,
    );
    await assertSettingsSecretNotExposed(page, marker);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);

    await attachJson(testInfo, "settings-ai-route-preferences-summary", {
      chatModel,
      automationModel,
      routeGroups: aiSettings.routeGroups,
      security: settingsSecuritySnapshot(page),
    });
  });
});

async function openAiSettings(page: Page) {
  await page.goto("/app/projects");
  await page.getByTestId("settings-entry-point").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByTestId("settings-tab-ai").click();
  await expect(page.getByTestId("settings-ai-route-card-chat_ai")).toBeVisible();
  await expect(page.getByTestId("settings-ai-route-card-automation_ai")).toBeVisible();
}

async function configureRouteCard(
  page: Page,
  routeGroup: "chat_ai" | "automation_ai",
  input: { readonly modelId: string; readonly apiKey: string },
) {
  await page.getByTestId(`settings-ai-base-url-${routeGroup}`).fill("https://api.example.com/v1");
  await page.getByTestId(`settings-ai-model-id-${routeGroup}`).fill(input.modelId);
  const replaceButton = page
    .getByTestId(`settings-ai-route-card-${routeGroup}`)
    .getByRole("button", { name: /Р—Р°РјРµРЅРёС‚СЊ|Replace/i });
  if (await replaceButton.isVisible().catch(() => false)) {
    await replaceButton.click();
  }
  await page.getByTestId(`settings-ai-api-key-${routeGroup}`).fill(input.apiKey);
}

async function saveRouteCard(page: Page, routeGroup: "chat_ai" | "automation_ai") {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(`/settings/ai/route-groups/${routeGroup}`) &&
      candidate.request().method() === "PATCH" &&
      candidate.ok(),
  );
  await page.getByTestId(`settings-ai-save-${routeGroup}`).click();
  await response;
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
