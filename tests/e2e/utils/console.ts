import { expect, type Page } from "@playwright/test";

type AllowlistEntry = RegExp | string;

const pageErrors = new WeakMap<Page, string[]>();
const installedPages = new WeakSet<Page>();

export function installConsoleGuards(page: Page) {
  if (installedPages.has(page)) {
    return;
  }

  installedPages.add(page);
  pageErrors.set(page, []);

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    pageErrors.get(page)?.push(message.text());
  });

  page.on("pageerror", (error) => {
    pageErrors.get(page)?.push(error.message);
  });
}

export async function assertNoConsoleErrors(
  page: Page,
  allowlist: readonly AllowlistEntry[] = [],
) {
  installConsoleGuards(page);
  const errors = pageErrors.get(page) ?? [];
  const unexpected = errors.filter((message) => !isAllowed(message, allowlist));

  expect(unexpected).toEqual([]);
}

export async function assertNoHydrationErrors(page: Page) {
  installConsoleGuards(page);
  const errors = pageErrors.get(page) ?? [];
  const hydrationErrors = errors.filter((message) =>
    /hydration|did not match|server html|text content does not match/i.test(message),
  );

  expect(hydrationErrors).toEqual([]);
}

function isAllowed(message: string, allowlist: readonly AllowlistEntry[]) {
  return allowlist.some((entry) =>
    typeof entry === "string" ? message.includes(entry) : entry.test(message),
  );
}
