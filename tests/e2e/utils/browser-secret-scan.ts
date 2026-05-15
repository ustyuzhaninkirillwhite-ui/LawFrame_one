import { expect, type Page, type Request } from "@playwright/test";
import { readBrowserStorage } from "./storage";

const forbiddenProviderHostPattern =
  /(api\.openai\.com|api\.cometapi\.com|openai\.azure\.com|api\.anthropic\.com|api\.x\.ai|generativelanguage\.googleapis\.com|api\.tavily\.com)/i;
const forbiddenRuntimeAdminPattern =
  /\/(admin|internal)\/.*activepieces|activepieces.*(admin|internal)/i;
const secretPattern =
  /(ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|SUPABASE_SERVICE_ROLE|service_role|BEGIN PRIVATE KEY|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,})/i;
const jwtLikePattern = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;

interface AutomationBrowserSecretScanState {
  readonly forbiddenCalls: string[];
  readonly secretLeaks: string[];
  readonly consoleLeaks: string[];
}

const states = new WeakMap<Page, AutomationBrowserSecretScanState>();

export function installAutomationBrowserSecretScan(page: Page) {
  if (states.has(page)) {
    return;
  }

  const state: AutomationBrowserSecretScanState = {
    forbiddenCalls: [],
    secretLeaks: [],
    consoleLeaks: [],
  };
  states.set(page, state);

  page.on("request", (request) => inspectRequest(request, state));
  page.on("console", (message) => {
    const text = message.text();
    if (/authorization\s*:/i.test(text) || secretPattern.test(text)) {
      state.consoleLeaks.push(text);
    }
  });
}

export async function assertNoAutomationBrowserSecrets(page: Page) {
  installAutomationBrowserSecretScan(page);
  const state = states.get(page);
  expect(state?.forbiddenCalls ?? []).toEqual([]);
  expect(state?.secretLeaks ?? []).toEqual([]);
  expect(state?.consoleLeaks ?? []).toEqual([]);

  const storage = JSON.stringify(await readBrowserStorage(page));
  expect(storage).not.toMatch(secretPattern);

  const body = await page.locator("body").innerText().catch(() => "");
  expect(body).not.toMatch(jwtLikePattern);
  expect(body).not.toMatch(secretPattern);
}

export function automationBrowserSecretScanSnapshot(page: Page) {
  const state = states.get(page) ?? {
    forbiddenCalls: [],
    secretLeaks: [],
    consoleLeaks: [],
  };

  return {
    forbiddenCalls: [...state.forbiddenCalls],
    secretLeaks: [...state.secretLeaks],
    consoleLeaks: [...state.consoleLeaks],
  };
}

function inspectRequest(request: Request, state: AutomationBrowserSecretScanState) {
  const url = request.url();
  const headers = request.headers();
  const postData = request.postData() ?? "";

  if (forbiddenProviderHostPattern.test(url)) {
    state.forbiddenCalls.push(url);
  }

  if (forbiddenRuntimeAdminPattern.test(url) && typeof headers.authorization === "string") {
    state.forbiddenCalls.push(`${url} with authorization`);
  }

  const serialized = JSON.stringify({
    url,
    headers,
    postData,
  });
  if (secretPattern.test(serialized)) {
    state.secretLeaks.push(url);
  }
}
