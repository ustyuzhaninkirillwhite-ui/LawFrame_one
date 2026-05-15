import { createSettingsClient } from "./settings-client";

test("settings API client posts provider keys only to LexFrame write-only backend endpoint", async () => {
  const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        id: "conn_001",
        workspaceId: "workspace_001",
        ownerScope: "workspace",
        ownerUserId: null,
        providerCode: "cometapi",
        uiLabel: "CometAPI",
        baseUrl: "https://api.cometapi.com/v1",
        modelId: "grok-4-1-fast-non-reasoning",
        enabled: true,
        secret: {
          hasSecret: true,
          secretStatus: "active",
          fingerprint: "sha256:fingerprint",
          lastUpdatedAt: "2026-05-13T00:00:00.000Z",
          backend: "supabase_vault",
        },
        capabilities: {
          streaming: true,
          jsonMode: true,
          structuredJsonSchema: true,
          toolCalls: false,
        },
        lastTestStatus: "not_tested",
        lastTestedAt: null,
        lastUsedAt: null,
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const client = createSettingsClient({
      baseUrl: "https://lexframe.example/api",
      getAccessToken: () => "session-token",
      getWorkspaceId: () => "workspace_001",
    });

    await client.replaceAiProviderConnectionSecret("conn_001", {
      apiKey: "sk-user-entered-write-only",
    });

    assertEqual(calls.length, 1);
    assertEqual(
      calls[0]?.url,
      "https://lexframe.example/api/settings/ai/provider-connections/conn_001/secret",
    );
    assertEqual(String(calls[0]?.url).includes("api.cometapi.com"), false);
    assertEqual(String(calls[0]?.url).includes("api.openai.com"), false);
    assertMatch(String(calls[0]?.init.body), /sk-user-entered-write-only/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("settings API client resolves chat and automation route groups on separate backend paths", async () => {
  const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        routeGroup: String(url).endsWith("/chat_ai")
          ? "chat_ai"
          : "automation_ai",
        scopeType: "workspace",
        workspaceId: "workspace_001",
        userId: null,
        providerConnectionId: "conn_001",
        providerCode: "cometapi",
        modelId: "grok-4-1-fast-non-reasoning",
        enabled: true,
        capabilitiesConfirmed: {
          streaming: true,
          jsonMode: true,
          structuredJsonSchema: true,
          toolCalls: false,
        },
        updatedAt: "2026-05-13T00:00:00.000Z",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const client = createSettingsClient({
      baseUrl: "https://lexframe.example/api",
    });

    await client.updateAiRouteGroupPreference("chat_ai", {
      scopeType: "workspace",
      providerConnectionId: "conn_001",
      enabled: true,
    });
    await client.updateAiRouteGroupPreference("automation_ai", {
      scopeType: "workspace",
      providerConnectionId: "conn_001",
      enabled: true,
      capabilitiesConfirmed: {
        structuredJsonSchema: true,
        jsonMode: true,
      },
    });

    assertDeepEqual(
      calls.map((call) => call.url),
      [
        "https://lexframe.example/api/settings/ai/route-groups/chat_ai",
        "https://lexframe.example/api/settings/ai/route-groups/automation_ai",
      ],
    );
    assertEqual(
      calls.some((call) => String(call.init.body).includes("apiKey")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function test(
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertMatch(actual: string, regex: RegExp): void {
  if (!regex.test(actual)) {
    throw new Error(`Expected ${actual} to match ${regex}`);
  }
}
