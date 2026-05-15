import { expect, type Page, type Request, type Response } from "@playwright/test";

const forbiddenHostPattern =
  /(api\.openai\.com|api\.x\.ai|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.deepseek\.com|api\.cometapi\.com)/i;
const forbiddenApAdminPattern =
  /cloud\.activepieces\.com\/api\/|\/activepieces\/(?:admin|internal)|\/automation-runtime\/(?:admin|internal)/i;
const supabaseAdminPattern = /supabase\.(?:co|in)\/.*(?:service_role|admin)|\/auth\/v1\/admin/i;
const secretLikePattern =
  /(OPENAI_API_KEY|COMETAPI_API_KEY|XAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DEEPSEEK_API_KEY|ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|BEGIN PRIVATE KEY|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,})/i;

interface NetworkSecurityState {
  readonly forbiddenHosts: string[];
  readonly secretLeaks: string[];
  readonly responseLeaks: string[];
}

const states = new WeakMap<Page, NetworkSecurityState>();

export function installNetworkSecurityScan(page: Page) {
  if (states.has(page)) {
    return;
  }

  const state: NetworkSecurityState = {
    forbiddenHosts: [],
    secretLeaks: [],
    responseLeaks: [],
  };
  states.set(page, state);
  page.on("request", (request) => inspectRequest(request, state));
  page.on("response", (response) => {
    void inspectResponse(response, state);
  });
}

export async function scanNetworkForForbiddenHosts(page: Page) {
  installNetworkSecurityScan(page);
  const state = states.get(page)!;
  expect(state.forbiddenHosts).toEqual([]);
  expect(state.secretLeaks).toEqual([]);
  expect(state.responseLeaks).toEqual([]);
  return {
    forbiddenHosts: [...state.forbiddenHosts],
    secretLeaks: [...state.secretLeaks],
    responseLeaks: [...state.responseLeaks],
  };
}

export function networkSecuritySnapshot(page: Page) {
  const state = states.get(page) ?? {
    forbiddenHosts: [],
    secretLeaks: [],
    responseLeaks: [],
  };
  return {
    forbiddenHosts: [...state.forbiddenHosts],
    secretLeaks: [...state.secretLeaks],
    responseLeaks: [...state.responseLeaks],
  };
}

function inspectRequest(request: Request, state: NetworkSecurityState) {
  const url = request.url();
  const headers = request.headers();
  const method = request.method();
  const postData = request.postData() ?? "";

  if (
    forbiddenHostPattern.test(url) ||
    forbiddenApAdminPattern.test(url) ||
    supabaseAdminPattern.test(url)
  ) {
    state.forbiddenHosts.push(`${method} ${new URL(url).host}${new URL(url).pathname}`);
  }

  const headerKeys = Object.keys(headers);
  const serialized = JSON.stringify({ url, headerKeys, postData });
  if (secretLikePattern.test(serialized)) {
    state.secretLeaks.push(`${method} ${new URL(url).host}${new URL(url).pathname}`);
  }
}

async function inspectResponse(response: Response, state: NetworkSecurityState) {
  const request = response.request();
  const responseUrl = new URL(response.url());
  if (responseUrl.pathname.startsWith("/_next/static/")) {
    return;
  }

  const contentType = response.headers()["content-type"] ?? "";
  if (!/json|text|html|javascript/i.test(contentType)) {
    return;
  }
  if (response.url().startsWith("data:")) {
    return;
  }

  try {
    const text = await response.text();
    if (secretLikePattern.test(text)) {
      state.responseLeaks.push(
        `${request.method()} ${responseUrl.host}${responseUrl.pathname}`,
      );
    }
  } catch {
    // Some streamed/cached responses cannot be read after consumption.
  }
}
