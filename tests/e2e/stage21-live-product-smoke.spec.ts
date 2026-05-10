import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const artifactPath = join(
  __dirname,
  "..",
  "..",
  "artifacts",
  "stage21",
  "live-product-smoke.json",
);
const progressArtifactPath = join(
  __dirname,
  "..",
  "..",
  "artifacts",
  "stage21",
  "live-product-smoke-progress.jsonl",
);
const forbiddenSecretPattern =
  /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|BEGIN PRIVATE KEY)/i;
const chatMarker = "LEXFRAME_CHAT_SMOKE_OK";

type DomainName =
  | "settings"
  | "projects"
  | "chat"
  | "automations"
  | "secretSafety";
type DomainStatus =
  | "PASS"
  | "PARTIAL_EXTERNAL_PROVIDER_BLOCKER"
  | "PARTIAL_RUNTIME_BLOCKER"
  | "FAIL";
type DomainResult = {
  readonly status: DomainStatus;
  readonly code: string | null;
  readonly message: string | null;
  readonly evidence: Record<string, unknown>;
};

test.describe("@stage21 @live-product-smoke Stage 21 live product smoke", () => {
  test.skip(
    process.env.LEXFRAME_STAGE21_LIVE_PRODUCT_SMOKE !== "1",
    "Stage 21 live product smoke is opt-in because it uses a real backend AI route.",
  );

  test("clicks through settings, projects, chat and automations with domain evidence", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const apiKey = requireEnv("LEXFRAME_STAGE21_AI_API_KEY");
    const providerCode = process.env.LEXFRAME_STAGE21_AI_PROVIDER_CODE ?? "cometapi";
    const baseUrl =
      process.env.LEXFRAME_STAGE21_AI_BASE_URL ?? "https://api.cometapi.com/v1";
    const modelId =
      process.env.LEXFRAME_STAGE21_AI_MODEL ?? "deepseek-v4-pro";
    const providerHost = new URL(baseUrl).host;
    const directProviderRequests: string[] = [];
    const allBrowserRequests: string[] = [];
    const browserChatRequests: string[] = [];
    const domainResults = createInitialDomainResults();

    page.on("request", (browserRequest) => {
      const url = browserRequest.url();
      allBrowserRequests.push(url);
      if (url.includes(providerHost)) {
        directProviderRequests.push(url);
      }
      try {
        const parsed = new URL(url);
        if (parsed.pathname.includes("/chat/threads")) {
          browserChatRequests.push(`${browserRequest.method()} ${parsed.pathname}`);
        }
      } catch {
        // Ignore non-URL browser-internal requests.
      }
    });

    const email = `stage21-live-${Date.now()}@lexframe.local`;
    let artifact: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      email,
      routeGroup: "chat_ai",
      provider: providerCode,
      providerHost,
      modelId,
      domainResults,
    };

    try {
      await signInAsDemo(page, {
        email,
        fullName: "Stage21 Live Smoke",
      });
      const session = await getWorkspaceApiSession(page, request);
      const headers = {
        ...session.headers,
        "content-type": "application/json",
      };

      const aiSetup = await configureChatAi({
        apiKey,
        baseUrl,
        headers,
        modelId,
        providerCode,
        request,
        session,
      });

      const shared: SharedSmokeContext = {
        apiKey,
        allBrowserRequests,
        baseUrl,
        directProviderRequests,
        browserChatRequests,
        headers,
        modelId,
        page,
        providerCode,
        providerHost,
        request,
        session,
      };

      const settings = await runSettingsDomain(shared, aiSetup.connectionId);
      domainResults.settings = settings.result;

      const projects = await runProjectsDomain(shared);
      domainResults.projects = projects.result;

      let chat: ChatDomainOutput = {
        result: fail("PROJECT_CONTEXT_MISSING", "Chat skipped because project creation failed."),
        chatThreadId: null,
        assistantMessageId: null,
        userMessageId: null,
      };
      if (projects.projectId) {
        chat = await runChatDomain(shared, projects.projectId);
      }
      domainResults.chat = chat.result;

      let automation: AutomationDomainOutput = {
        result: fail(
          "PROJECT_CONTEXT_MISSING",
          "Automation smoke skipped because project creation failed.",
        ),
        automationId: null,
      };
      if (projects.projectId) {
        automation = await runAutomationsDomain(shared, projects.projectId);
      }
      domainResults.automations = automation.result;

      domainResults.secretSafety = await runSecretSafetyDomain(shared);

      artifact = {
        generatedAt: new Date().toISOString(),
        actorUserId: readDevTokenUserId(session.token),
        email,
        workspaceId: session.workspaceId,
        projectId: projects.projectId,
        projectName: projects.projectName,
        organizationDisplayName: settings.organizationDisplayName,
        chatThreadId: chat.chatThreadId,
        assistantMessageId: chat.assistantMessageId,
        userMessageId: chat.userMessageId,
        connectionId: aiSetup.connectionId,
        routeGroup: "chat_ai",
        provider: providerCode,
        providerHost,
        modelId,
        connectionTest: settings.connectionTest,
        automation: {
          automationId: automation.automationId,
          ...(automation.result.evidence ?? {}),
        },
        browserNetwork: {
          directProviderRequests: directProviderRequests.length,
          chatRequests: browserChatRequests,
          requestCount: allBrowserRequests.length,
        },
        browserStorageScanned: domainResults.secretSafety.status === "PASS",
        domainResults,
      };
    } catch (error) {
      const sanitized = sanitizeError(error, apiKey);
      markUnsetDomainsFailed(domainResults, sanitized.code, sanitized.message);
      artifact = {
        ...artifact,
        generatedAt: new Date().toISOString(),
        unexpectedError: sanitized,
        domainResults,
      };
    } finally {
      expect(JSON.stringify(artifact).includes(apiKey)).toBe(false);
      expect(JSON.stringify(artifact)).not.toMatch(forbiddenSecretPattern);
      mkdirSync(join(__dirname, "..", "..", "artifacts", "stage21"), {
        recursive: true,
      });
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    }

    const failedDomains = Object.entries(domainResults)
      .filter(([, result]) => result.status === "FAIL")
      .map(([domain, result]) => `${domain}:${result.code ?? "FAIL"}`);
    expect(failedDomains).toEqual([]);
  });
});

async function runSettingsDomain(
  shared: SharedSmokeContext,
  connectionId: string,
) {
  let organizationDisplayName: string | null = null;
  let connectionTest: Record<string, unknown> | null = null;

  try {
    await shared.page.goto("/app");
    await shared.page.getByTestId("settings-entry-point").first().click();
    const dialog = shared.page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByTestId("settings-profile-display-name").fill("Stage21 Live Smoke Updated");
    await dialog.getByTestId("settings-profile-first-name").fill("Stage21");
    await dialog.getByTestId("settings-profile-last-name").fill("Smoke");
    const profilePatch = shared.page.waitForResponse(
      (response) =>
        response.url().includes("/settings/profile") &&
        response.request().method() === "PATCH",
      { timeout: 10_000 },
    );
    await dialog.getByTestId("settings-save-button").click();
    const profilePatchResponse = await profilePatch;
    expect(
      profilePatchResponse.ok(),
      await profilePatchResponse.text(),
    ).toBeTruthy();
    await expect
      .poll(
        async () => {
          const response = await shared.request.get(
            `${shared.session.apiBaseUrl}/settings/bootstrap`,
            { headers: shared.session.headers },
          );
          const payload = (await response.json()) as {
            readonly profile: { readonly displayName: string | null };
          };
          return payload.profile.displayName;
        },
        { timeout: 15_000 },
      )
      .toBe("Stage21 Live Smoke Updated");

    await dialog.getByTestId("settings-tab-organization").click();
    await expect(dialog.getByTestId("settings-organization-display-name")).toBeVisible();
    organizationDisplayName = `Stage21 Org ${Date.now()}`;
    await dialog.getByTestId("settings-organization-display-name").fill(organizationDisplayName);
    await dialog.getByTestId("settings-organization-legal-name").fill(`${organizationDisplayName} LLC`);
    const organizationPatch = shared.page.waitForResponse(
      (response) =>
        response.url().includes("/settings/organization") &&
        response.request().method() === "PATCH",
      { timeout: 10_000 },
    );
    await dialog.getByTestId("settings-save-button").click();
    const organizationPatchResponse = await organizationPatch;
    expect(
      organizationPatchResponse.ok(),
      await organizationPatchResponse.text(),
    ).toBeTruthy();
    await expect
      .poll(
        async () => {
          const response = await shared.request.get(
            `${shared.session.apiBaseUrl}/settings/bootstrap`,
            { headers: shared.session.headers },
          );
          const payload = (await response.json()) as {
            readonly organization: {
              readonly organizationDisplayName: string | null;
            } | null;
          };
          return payload.organization?.organizationDisplayName ?? null;
        },
        { timeout: 15_000 },
      )
      .toBe(organizationDisplayName);

    await dialog.getByTestId("settings-tab-ai").click();
    await expect
      .poll(
        async () => {
          const response = await shared.request.get(
            `${shared.session.apiBaseUrl}/settings/ai`,
            { headers: shared.session.headers },
          );
          const payload = await response.json();
          return JSON.stringify(payload).includes(connectionId);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const settingsResponse = await shared.request.get(
      `${shared.session.apiBaseUrl}/settings/ai`,
      { headers: shared.session.headers },
    );
    expect(settingsResponse.ok(), await settingsResponse.text()).toBeTruthy();
    expect(JSON.stringify(await settingsResponse.json()).includes(shared.apiKey)).toBe(false);

    const testResult = await shared.request.post(
      `${shared.session.apiBaseUrl}/settings/ai/provider-connections/${connectionId}/test`,
      { headers: shared.session.headers },
    );
    expect(testResult.ok(), await testResult.text()).toBeTruthy();
    const testPayload = (await testResult.json()) as {
      readonly status: string;
      readonly message: string;
      readonly testedAt: string;
    };
    expect(JSON.stringify(testPayload).includes(shared.apiKey)).toBe(false);
    connectionTest = testPayload;

    return {
      result: pass({
        connectionId,
        connectionTestStatus: testPayload.status,
        profileDisplayName: "Stage21 Live Smoke Updated",
        organizationDisplayName,
      }),
      organizationDisplayName,
      connectionTest,
    };
  } catch (error) {
    const sanitized = sanitizeError(error, shared.apiKey);
    return {
      result: fail(sanitized.code, sanitized.message, sanitized.evidence),
      organizationDisplayName,
      connectionTest,
    };
  } finally {
    if (await shared.page.getByRole("dialog").first().isVisible().catch(() => false)) {
      await shared.page.keyboard.press("Escape").catch(() => undefined);
    }
  }
}

async function runProjectsDomain(shared: SharedSmokeContext) {
  let projectId: string | null = null;
  const projectName = `Stage21 Live ${Date.now()}`;

  try {
    await shared.page.locator('a[href="/app/projects"]').first().click();
    await expect(shared.page).toHaveURL(/\/app\/projects$/);
    await shared.page.locator("form input").first().fill(projectName);
    await shared.page.locator('form button[type="submit"]').first().click();
    await expect(shared.page).toHaveURL(/\/app\/projects\/[^/]+$/);
    projectId = shared.page.url().match(/\/app\/projects\/([^/?#]+)/)?.[1] ?? null;
    expect(projectId).toBeTruthy();

    return {
      result: pass({
        projectId,
        projectName,
        createdWithoutManualReload: true,
      }),
      projectId,
      projectName,
    };
  } catch (error) {
    const sanitized = sanitizeError(error, shared.apiKey);
    return {
      result: fail(sanitized.code, sanitized.message, sanitized.evidence),
      projectId,
      projectName,
    };
  }
}

async function runChatDomain(shared: SharedSmokeContext, projectId: string): Promise<ChatDomainOutput> {
  let chatThreadId: string | null = null;
  let assistantMessageId: string | null = null;
  let userMessageId: string | null = null;

  try {
    recordStage21Progress("chat:start", { projectId });
    await shared.page.getByTestId("project-new-chat-button").click();
    await expect(shared.page).toHaveURL(new RegExp(`/app/projects/${projectId}/chats/[^/]+$`));
    chatThreadId = shared.page.url().match(/\/chats\/([^/?#]+)/)?.[1] ?? null;
    expect(chatThreadId).toBeTruthy();
    recordStage21Progress("chat:thread-created", { projectId, chatThreadId });

    const composer = shared.page.getByTestId("chat-composer-input");
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill("Shift line");
    await shared.page.keyboard.press("Shift+Enter");
    await composer.type("kept");
    await expect.poll(() => composer.inputValue()).toContain("\nkept");
    await composer.fill(`Check chat connection. Return marker ${chatMarker}.`);
    await shared.page.keyboard.press("Enter");
    recordStage21Progress("chat:message-submitted", { chatThreadId });

    const streamError = shared.page.getByTestId("chat-stream-error");
    let observedChatState = "waiting";
    let messages: Awaited<ReturnType<typeof readThreadMessages>> | null = null;
    await expect
      .poll(
        async () => {
          const hasStreamError = await streamError.isVisible().catch(() => false);
          const errorText = hasStreamError
            ? await streamError.textContent().catch(() => null)
            : null;
          if (errorText) {
            observedChatState = "error";
            return `error:${errorText}`;
          }
          const persistedMessages = await readThreadMessages(shared, chatThreadId!).catch(
            () => null,
          );
          if (persistedMessages) {
            messages = persistedMessages;
            const persistedUserMessage = findMessageWithMarker(persistedMessages, "user");
            const persistedAssistantMessage = findMessageWithMarker(
              persistedMessages,
              "assistant",
            );
            if (persistedUserMessage && persistedAssistantMessage) {
              observedChatState = "persisted";
              recordStage21Progress("chat:persisted-marker", {
                chatThreadId,
                userMessageId: persistedUserMessage.id,
                assistantMessageId: persistedAssistantMessage.id,
              });
              return "persisted";
            }
          }
          return "waiting";
        },
        {
          timeout: 90_000,
          intervals: [1_000, 2_000, 3_000],
          message:
            "waiting for assistant marker, persisted assistant response, or controlled chat diagnostic",
        },
      )
      .not.toBe("waiting");

    await expect(
      shared.page.locator('[aria-label="LexFrame РіРѕС‚РѕРІРёС‚ РѕС‚РІРµС‚"]'),
    ).toHaveCount(0, { timeout: 15_000 });

    messages ??= await readThreadMessages(shared, chatThreadId!);
    const userMessage = findMessageWithMarker(messages, "user");
    userMessageId = userMessage?.id ?? null;
    expect(userMessageId).toBeTruthy();
    recordStage21Progress("chat:user-message-confirmed", { chatThreadId, userMessageId });

    const streamErrorVisible = await streamError.isVisible().catch(() => false);
    const streamErrorText = streamErrorVisible
      ? await streamError.textContent({ timeout: 1_000 }).catch(() => null)
      : null;
    if (streamErrorText) {
      expect(JSON.stringify(messages).includes(shared.apiKey)).toBe(false);
      expect(streamErrorText).not.toMatch(forbiddenSecretPattern);
      expect(streamErrorText.includes(shared.apiKey)).toBe(false);
      return {
        result: partialExternalProvider("AI_PROVIDER_CONTROLLED_FAILURE", streamErrorText, {
          chatThreadId,
          userMessageId,
          assistantMessageId: null,
          controlledDiagnosticVisible: true,
          runningStateCompleted: true,
        }),
        chatThreadId,
        assistantMessageId: null,
        userMessageId,
      };
    }

    const assistantMessage = findMessageWithMarker(messages, "assistant");
    assistantMessageId = assistantMessage?.id ?? null;
    expect(assistantMessageId).toBeTruthy();
    expect(JSON.stringify(messages).includes(shared.apiKey)).toBe(false);
    recordStage21Progress("chat:assistant-message-confirmed", {
      chatThreadId,
      assistantMessageId,
    });
    await expect
      .poll(() => assistantMarkerTextVisible(shared.page), {
        timeout: 15_000,
        intervals: [500, 1_000, 2_000],
      })
      .toBe(true);
    recordStage21Progress("chat:ui-marker-confirmed", { chatThreadId });

    await shared.page.locator('a[href="/app/projects"]').first().click();
    await expect(shared.page).toHaveURL(/\/app\/projects$/, { timeout: 15_000 });
    recordStage21Progress("chat:navigated-projects", { chatThreadId });
    await shared.page.goto(`/app/projects/${projectId}/chats/${chatThreadId}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await expect
      .poll(() => assistantMarkerTextVisible(shared.page), {
        timeout: 15_000,
        intervals: [1_000, 2_000],
      })
      .toBe(true);
    recordStage21Progress("chat:persistence-ui-confirmed", { chatThreadId });

    return {
      result: pass({
        chatThreadId,
        userMessageId,
        assistantMessageId,
        markerPersisted: true,
        uiMarkerObserved: observedChatState,
        runningStateCompleted: true,
      }),
      chatThreadId,
      assistantMessageId,
      userMessageId,
    };
  } catch (error) {
    const sanitized = sanitizeError(error, shared.apiKey);
    return {
      result: fail(sanitized.code, sanitized.message, {
        ...sanitized.evidence,
        chatThreadId,
        userMessageId,
        assistantMessageId,
      }),
      chatThreadId,
      assistantMessageId,
      userMessageId,
    };
  }
}

async function runAutomationsDomain(
  shared: SharedSmokeContext,
  projectId: string,
): Promise<AutomationDomainOutput> {
  let automationId: string | null = null;
  let readinessPayload: Record<string, unknown> | null = null;

  try {
    await shared.page
      .locator(`a[href="/app/projects/${projectId}/automations"]`)
      .first()
      .click();
    await expect(shared.page).toHaveURL(new RegExp(`/app/projects/${projectId}/automations`));
    await expect(shared.page.locator("body")).not.toContainText(
      /stack trace|Unhandled|Authorization|Bearer|jwt[_-]?token/i,
    );

    const ensureAutomation = await shared.request.post(
      `${shared.session.apiBaseUrl}/projects/${projectId}/automations/stage17-canvas/ensure`,
      { headers: shared.session.headers },
    );
    const ensureText = await ensureAutomation.text();
    expect(ensureText.includes(shared.apiKey)).toBe(false);
    expect(ensureText).not.toMatch(/duplicate key|unique constraint|stack trace|Bearer/i);
    const automationPayload = safeJson(ensureText) as {
      readonly automationId?: string | null;
      readonly automation_id?: string | null;
      readonly status?: string;
      readonly readinessCode?: string | null;
      readonly readiness_code?: string | null;
      readonly route?: string | null;
      readonly error?: {
        readonly code?: string | null;
        readonly details?: Record<string, unknown> | null;
      };
    };
    automationId = automationPayload.automationId ?? automationPayload.automation_id ?? null;

    if (ensureAutomation.status() >= 500) {
      const errorPayload = automationPayload.error ?? null;
      if (errorPayload?.code !== "ACTIVEPIECES_RUNTIME_UNAVAILABLE") {
        expect(ensureAutomation.status(), ensureText).toBeLessThan(500);
      }
      automationId = automationId ?? (await inferAutomationId(shared, projectId));
      const canvasState = automationId
        ? await openAutomationCanvasAndReadState(shared, projectId, automationId, null)
        : "not_created";
      return {
        result: partialRuntime("ACTIVEPIECES_RUNTIME_UNAVAILABLE", {
          automationId,
          ensureHttpStatus: ensureAutomation.status(),
          errorCode: errorPayload?.code ?? null,
          reasonCode: errorPayload?.details?.reasonCode ?? null,
          canvasState,
          routeContextPreserved: Boolean(automationId),
        }),
        automationId,
      };
    }

    if (!automationId) {
      return {
        result: partialRuntime("ACTIVEPIECES_ENSURE_NO_AUTOMATION_ID", {
          automationId: null,
          ensureStatus: automationPayload.status ?? null,
          readinessCode:
            automationPayload.readinessCode ?? automationPayload.readiness_code ?? null,
        }),
        automationId: null,
      };
    }

    const readiness = await shared.request.get(
      `${shared.session.apiBaseUrl}/projects/${projectId}/automations/${automationId}/canvas-readiness`,
      { headers: shared.session.headers },
    );
    const readinessText = await readiness.text();
    expect(readiness.status(), readinessText).toBeLessThan(500);
    readinessPayload = safeJson(readinessText) as Record<string, unknown>;

    const targetRoute =
      automationPayload.route ??
      `/app/projects/${projectId}/automations/${automationId}/automation`;
    const link = shared.page.locator(`a[href="${targetRoute}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await shared.page.goto(targetRoute);
    }
    await expect(shared.page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/automations/${automationId}/automation`),
      { timeout: 30_000 },
    );

    const body = shared.page.locator("body");
    const canvasContainer = shared.page.getByTestId("activepieces-canvas-container");
    const unavailableState = shared.page.getByTestId("builder-unavailable-state");
    await expect
      .poll(
        async () => {
          if (await canvasContainer.isVisible().catch(() => false)) {
            return "canvas";
          }
          if (await unavailableState.isVisible().catch(() => false)) {
            return "controlled-diagnostic";
          }
          return "waiting";
        },
        { timeout: 45_000 },
      )
      .not.toBe("waiting");
    await expect(body).not.toContainText(
      /stack trace|Unhandled|Authorization|Bearer|jwt[_-]?token/i,
    );

    await shared.page.locator('a[href="/app/projects"]').first().click();
    await expect(shared.page.locator("body")).not.toContainText(
      /stack trace|Unhandled|Authorization|Bearer|jwt[_-]?token/i,
    );
    await shared.page.goto(`/app/projects/${projectId}/automations/${automationId}/automation`);
    await expect
      .poll(
        async () => {
          if (await canvasContainer.isVisible().catch(() => false)) {
            return "canvas";
          }
          if (await unavailableState.isVisible().catch(() => false)) {
            return "controlled-diagnostic";
          }
          return "waiting";
        },
        { timeout: 45_000 },
      )
      .not.toBe("waiting");

    const readinessStatus = String(
      readinessPayload.status ?? automationPayload.status ?? "unknown",
    );
    const readinessCode = String(
      readinessPayload.readinessCode ??
        readinessPayload.readiness_code ??
        automationPayload.readinessCode ??
        automationPayload.readiness_code ??
        "UNKNOWN",
    );
    const isReady = readinessStatus === "ready" || readinessStatus === "repaired";
    const controlledState = await unavailableState.isVisible().catch(() => false);
    return {
      result:
        isReady && !controlledState
          ? pass({
              automationId,
              readinessStatus,
              readinessCode,
              canvasState: "canvas",
              routeContextPreserved: true,
            })
          : partialRuntime("ACTIVEPIECES_CONTROLLED_RUNTIME_STATE", {
              automationId,
              readinessStatus,
              readinessCode,
              canvasState: controlledState ? "controlled-diagnostic" : "canvas",
              routeContextPreserved: true,
            }),
      automationId,
    };
  } catch (error) {
    const sanitized = sanitizeError(error, shared.apiKey);
    return {
      result: fail(sanitized.code, sanitized.message, {
        ...sanitized.evidence,
        automationId,
        readiness: readinessPayload,
      }),
      automationId,
    };
  }
}

async function runSecretSafetyDomain(shared: SharedSmokeContext) {
  try {
    const browserStorage = await readBrowserStorage(shared.page);
    const browserStorageText = JSON.stringify(browserStorage);
    expect(browserStorageText.includes(shared.apiKey)).toBe(false);
    expect(shared.directProviderRequests).toEqual([]);
    expect(JSON.stringify(shared.allBrowserRequests).includes(shared.apiKey)).toBe(false);
    expect(browserStorageText).not.toMatch(forbiddenSecretPattern);
    return pass({
      browserStorageScanned: true,
      directProviderRequests: shared.directProviderRequests.length,
      browserRequestCount: shared.allBrowserRequests.length,
    });
  } catch (error) {
    const sanitized = sanitizeError(error, shared.apiKey);
    return fail(sanitized.code, sanitized.message, sanitized.evidence);
  }
}

async function inferAutomationId(shared: SharedSmokeContext, projectId: string) {
  const fromUrl =
    shared.page.url().match(/\/automations\/([^/?#]+)\/automation/)?.[1] ?? null;
  if (fromUrl) {
    return fromUrl;
  }

  const response = await shared.request.get(
    `${shared.session.apiBaseUrl}/projects/${projectId}/automations`,
    { headers: shared.session.headers },
  );
  if (!response.ok()) {
    return null;
  }
  type AutomationListItem = { readonly id?: string | null };
  const payload = safeJson(await response.text()) as
    | readonly AutomationListItem[]
    | { readonly items?: readonly AutomationListItem[] };
  const items: readonly AutomationListItem[] = Array.isArray(payload)
    ? (payload as readonly AutomationListItem[])
    : (payload as { readonly items?: readonly AutomationListItem[] }).items ?? [];
  return items.find((item) => item.id)?.id ?? null;
}

async function openAutomationCanvasAndReadState(
  shared: SharedSmokeContext,
  projectId: string,
  automationId: string,
  route: string | null,
) {
  await shared.page.goto(
    route ?? `/app/projects/${projectId}/automations/${automationId}/automation`,
  );
  await expect(shared.page).toHaveURL(
    new RegExp(`/app/projects/${projectId}/automations/${automationId}/automation`),
    { timeout: 30_000 },
  );
  const canvasContainer = shared.page.getByTestId("activepieces-canvas-container");
  const unavailableState = shared.page.getByTestId("builder-unavailable-state");
  let state = "waiting";
  await expect
    .poll(
      async () => {
        if (await canvasContainer.isVisible().catch(() => false)) {
          state = "canvas";
          return state;
        }
        if (await unavailableState.isVisible().catch(() => false)) {
          state = "controlled-diagnostic";
          return state;
        }
        state = "waiting";
        return "waiting";
      },
      { timeout: 45_000 },
    )
    .not.toBe("waiting");
  await expect(shared.page.locator("body")).not.toContainText(
    /stack trace|Unhandled|Authorization|Bearer|jwt[_-]?token|duplicate key|unique constraint/i,
  );
  return state;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function configureChatAi(input: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
  readonly modelId: string;
  readonly providerCode: string;
  readonly request: APIRequestContext;
  readonly session: Awaited<ReturnType<typeof getWorkspaceApiSession>>;
}) {
  const settingsResponse = await input.request.get(
    `${input.session.apiBaseUrl}/settings/ai`,
    { headers: input.session.headers },
  );
  expect(settingsResponse.ok(), await settingsResponse.text()).toBeTruthy();
  const settings = (await settingsResponse.json()) as {
    readonly providerConnections?: readonly {
      readonly id: string;
      readonly providerCode: string;
      readonly baseUrl: string;
      readonly modelId: string;
    }[];
    readonly routeGroups?: readonly {
      readonly routeGroup: string;
      readonly providerConnectionId?: string | null;
    }[];
  };
  const preferredConnectionId =
    settings.routeGroups?.find((routeGroup) => routeGroup.routeGroup === "chat_ai")
      ?.providerConnectionId ?? null;
  const existing =
    settings.providerConnections?.find((connection) => connection.id === preferredConnectionId) ??
    settings.providerConnections?.find(
      (connection) =>
        connection.providerCode === input.providerCode &&
        connection.baseUrl === input.baseUrl &&
        connection.modelId === input.modelId,
    ) ??
    null;
  const capabilities = {
    streaming: true,
    jsonMode: true,
    structuredJsonSchema: true,
    toolCalls: true,
  };

  let connection: { readonly id: string };
  if (existing) {
    const updateResponse = await input.request.patch(
      `${input.session.apiBaseUrl}/settings/ai/provider-connections/${existing.id}`,
      {
        headers: input.headers,
        data: {
          format: "manual_form",
          providerCode: input.providerCode,
          baseUrl: input.baseUrl,
          modelId: input.modelId,
          capabilities,
          enabled: true,
        },
      },
    );
    expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy();
    const secretResponse = await input.request.post(
      `${input.session.apiBaseUrl}/settings/ai/provider-connections/${existing.id}/secret`,
      {
        headers: input.headers,
        data: { apiKey: input.apiKey },
      },
    );
    expect(secretResponse.ok(), await secretResponse.text()).toBeTruthy();
    connection = (await secretResponse.json()) as { readonly id: string };
  } else {
    const createResponse = await input.request.post(
      `${input.session.apiBaseUrl}/settings/ai/provider-connections`,
      {
        headers: input.headers,
        data: {
          format: "manual_form",
          routeGroup: "chat_ai",
          ownerScope: "workspace",
          providerCode: input.providerCode,
          baseUrl: input.baseUrl,
          modelId: input.modelId,
          apiKey: input.apiKey,
          capabilities,
        },
      },
    );
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
    connection = (await createResponse.json()) as { readonly id: string };
  }

  const routeResponse = await input.request.patch(
    `${input.session.apiBaseUrl}/settings/ai/route-groups/chat_ai`,
    {
      headers: input.headers,
      data: {
        format: "manual_form",
        scopeType: "workspace",
        providerConnectionId: connection.id,
        modelId: input.modelId,
        enabled: true,
        capabilitiesConfirmed: capabilities,
      },
    },
  );
  expect(routeResponse.ok(), await routeResponse.text()).toBeTruthy();

  return { connectionId: connection.id };
}

async function readThreadMessages(shared: SharedSmokeContext, chatThreadId: string) {
  const messagesResponse = await shared.request.get(
    `${shared.session.apiBaseUrl}/chat/threads/${chatThreadId}/messages`,
    { headers: shared.session.headers, timeout: 10_000 },
  );
  expect(messagesResponse.ok(), await messagesResponse.text()).toBeTruthy();
  return (await messagesResponse.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly role: string;
      readonly parts: readonly { readonly text?: string | null }[];
    }[];
  };
}

function findMessageWithMarker(
  messages: Awaited<ReturnType<typeof readThreadMessages>>,
  role: "assistant" | "user",
) {
  return messages.items.find(
    (message) =>
      message.role === role && message.parts.some((part) => part.text?.includes(chatMarker)),
  );
}

function createInitialDomainResults(): Record<DomainName, DomainResult> {
  return {
    settings: fail("NOT_RUN", "Settings smoke did not run."),
    projects: fail("NOT_RUN", "Projects smoke did not run."),
    chat: fail("NOT_RUN", "Chat smoke did not run."),
    automations: fail("NOT_RUN", "Automations smoke did not run."),
    secretSafety: fail("NOT_RUN", "Secret-safety smoke did not run."),
  };
}

function pass(evidence: Record<string, unknown>): DomainResult {
  return {
    status: "PASS",
    code: null,
    message: null,
    evidence,
  };
}

function fail(
  code: string,
  message: string,
  evidence: Record<string, unknown> = {},
): DomainResult {
  return {
    status: "FAIL",
    code,
    message,
    evidence,
  };
}

function partialExternalProvider(
  code: string,
  message: string,
  evidence: Record<string, unknown>,
): DomainResult {
  return {
    status: "PARTIAL_EXTERNAL_PROVIDER_BLOCKER",
    code,
    message,
    evidence,
  };
}

function partialRuntime(
  code: string,
  evidence: Record<string, unknown>,
): DomainResult {
  return {
    status: "PARTIAL_RUNTIME_BLOCKER",
    code,
    message: "Automation runtime produced a controlled non-ready state.",
    evidence,
  };
}

function markUnsetDomainsFailed(
  domainResults: Record<DomainName, DomainResult>,
  code: string,
  message: string,
) {
  for (const domain of Object.keys(domainResults) as DomainName[]) {
    if (domainResults[domain].code === "NOT_RUN") {
      domainResults[domain] = fail(code, message);
    }
  }
}

function sanitizeError(error: unknown, apiKey: string) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.replaceAll(apiKey, "[redacted]");
  return {
    code:
      error instanceof Error && error.name && error.name !== "Error"
        ? error.name
        : "STAGE21_DOMAIN_ERROR",
    message: message.slice(0, 500),
    evidence: {
      name: error instanceof Error ? error.name : typeof error,
    },
  };
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Stage 21 live product smoke.`);
  }
  return value;
}

function recordStage21Progress(step: string, evidence: Record<string, unknown> = {}) {
  mkdirSync(join(__dirname, "..", "..", "artifacts", "stage21"), {
    recursive: true,
  });
  appendFileSync(
    progressArtifactPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      step,
      evidence,
    })}\n`,
  );
}

async function assistantMarkerTextVisible(page: Page) {
  const assistantTexts = await page
    .locator('[data-message-role="assistant"]')
    .allTextContents()
    .catch(() => []);
  if (assistantTexts.some((text) => text.includes(chatMarker))) {
    return true;
  }

  const assistantArticleTexts = await page
    .locator("article")
    .allTextContents()
    .catch(() => []);
  return assistantArticleTexts.some(
    (text) => text.includes("LexFrame") && text.includes(chatMarker),
  );
}

async function readBrowserStorage(page: Page) {
  return page.evaluate(() => ({
    localStorage: { ...window.localStorage },
    sessionStorage: { ...window.sessionStorage },
    cookies: document.cookie,
  }));
}

function readDevTokenUserId(token: string) {
  const match = token.match(/^dev\.([A-Za-z0-9_-]+)$/);
  if (!match) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(match[1]!, "base64url").toString("utf8")) as {
      readonly id?: string;
    };
    return payload.id ?? null;
  } catch {
    return null;
  }
}

type SharedSmokeContext = {
  readonly apiKey: string;
  readonly allBrowserRequests: readonly string[];
  readonly browserChatRequests: readonly string[];
  readonly baseUrl: string;
  readonly directProviderRequests: readonly string[];
  readonly headers: Record<string, string>;
  readonly modelId: string;
  readonly page: Page;
  readonly providerCode: string;
  readonly providerHost: string;
  readonly request: APIRequestContext;
  readonly session: Awaited<ReturnType<typeof getWorkspaceApiSession>>;
};

type ChatDomainOutput = {
  readonly result: DomainResult;
  readonly chatThreadId: string | null;
  readonly assistantMessageId: string | null;
  readonly userMessageId: string | null;
};

type AutomationDomainOutput = {
  readonly result: DomainResult;
  readonly automationId: string | null;
};
