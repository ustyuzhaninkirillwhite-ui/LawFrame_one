import { expect, type Page } from "@playwright/test";

const secretLikePattern =
  /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|BEGIN PRIVATE KEY)/i;

export async function readBrowserStorage(page: Page) {
  return page.evaluate(() => ({
    localStorage: { ...window.localStorage },
    sessionStorage: { ...window.sessionStorage },
    cookies: document.cookie,
  }));
}

export async function assertNoSecretsInBrowserStorage(page: Page) {
  const serialized = JSON.stringify(await readBrowserStorage(page));

  expect(serialized).not.toMatch(secretLikePattern);
}

export async function clearBrowserStorage(page: Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}
