import { expect, test, type Page } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertEmbedConfigSafe,
  assertNoActivepiecesServerSecretsInStorage,
  scanStorageForActivepiecesJwt,
  waitForBuilderSurface,
} from "./utils/activepieces";
import {
  ensureAutomationCanvas,
  openAutomationCanvas,
  openEnsuredAutomationCanvas,
  runtimeHeaders,
} from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 Activepieces session and JWT security", () => {
  test.beforeEach(async ({ page }) => {
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-session-${Date.now()}@lexframe.local`,
      fullName: "Block4 Session User",
    });
  });

  test("session response exposes only short-lived embed token config and rejects client-controlled fields", async ({
    page,
    request,
  }) => {
    const api = await getWorkspaceApiSession(page, request);
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const headers = runtimeHeaders(api);

    const sessionResponse = await request.post(`${api.apiBaseUrl}/activepieces/session`, {
      headers,
      data: {
        workspace_id: api.workspaceId,
        project_id: projectId,
        automation_id: canvas.automation_id,
        purpose: "automation_canvas",
        client_route: canvas.route,
        mode_preference: "auto",
        return_builder_config: true,
        client_trace_id: `block4-${Date.now()}`,
      },
    });
    expect(sessionResponse.status(), await sessionResponse.text()).toBeLessThan(500);
    const sessionPayload = await sessionResponse.json();
    assertEmbedConfigSafe(sessionPayload);
    expect(["ready", "degraded", "blocked", "unavailable"]).toContain(sessionPayload.status);
    if (sessionPayload.status === "ready" || sessionPayload.status === "degraded") {
      expect(sessionPayload.jwt_token).toBeTruthy();
      expect(sessionPayload.ttl_seconds).toBeLessThanOrEqual(300);
      expect(sessionPayload.sdk_config?.embedding?.locale).toBe("ru");
      expect(sessionPayload.pieces_policy?.pieces_filter_type).toBeTruthy();
    }

    const deniedResponse = await request.post(`${api.apiBaseUrl}/activepieces/session`, {
      headers,
      data: {
        workspace_id: api.workspaceId,
        project_id: projectId,
        automation_id: canvas.automation_id,
        purpose: "automation_canvas",
        client_route: canvas.route,
        jwt_token: "client-supplied-token",
      },
    });
    expect(deniedResponse.status()).toBe(400);
    const denied = await deniedResponse.json();
    expect(denied.error?.code ?? denied.code).toBe("INVALID_CLIENT_FIELD");
  });

  test("browser storage keeps no AP API key, signing key, provider key or raw server secret", async ({
    page,
    request,
  }) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await openAutomationCanvas(page, projectId, canvas.automation_id);
    await waitForBuilderSurface(page);

    const apJwt = await scanStorageForActivepiecesJwt(page);
    for (const token of apJwt) {
      expect(token.valueLength).toBeLessThan(4096);
    }
    await assertNoActivepiecesServerSecretsInStorage(page);
    await assertNoAutomationBrowserSecrets(page);
  });

  test("automation route DOM and browser storage expose no provider or runtime secrets", async ({
    page,
    request,
  }, testInfo) => {
    await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);

    const scan = await scanAutomationRouteSurface(page);
    await testInfo.attach("automation-route-secret-scan", {
      body: Buffer.from(`${JSON.stringify(scan, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });

    expect(scan.serialized).not.toMatch(routeSecretPattern);
    await assertNoActivepiecesServerSecretsInStorage(page);
    await assertNoAutomationBrowserSecrets(page);
  });
});

const routeSecretPattern =
  /(ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE|service_role|BEGIN PRIVATE KEY|private[_\s-]?key|provider[_\s-]?key|jwt_token|jwtToken|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/i;

async function scanAutomationRouteSurface(page: Page) {
  const surface = await page.evaluate(() => {
    const iframeTexts: string[] = [];
    for (const iframe of Array.from(document.querySelectorAll("iframe"))) {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        iframeTexts.push(doc.title, doc.body.innerText);
      }
    }

    return {
      domText: document.body.innerText,
      iframeTexts,
      storage: {
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
      },
    };
  });

  return {
    ...surface,
    serialized: JSON.stringify(surface),
  };
}
