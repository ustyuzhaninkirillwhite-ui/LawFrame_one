import { expect, type Page } from "@playwright/test";

export async function signInAsDemo(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
  },
  options?: {
    readonly createWorkspaceIfNeeded?: boolean;
  },
) {
  await page.goto("/sign-in");
  try {
    await page.waitForFunction(
      () => {
        const lexframeWindow = window as Window & {
          __LEXFRAME_MSW_READY?: boolean;
        };

        return (
          lexframeWindow.__LEXFRAME_MSW_READY === true ||
          navigator.serviceWorker?.controller !== null
        );
      },
      undefined,
      {
        timeout: 15_000,
      },
    );
  } catch {
    await page.waitForTimeout(1_000);
  }
  const signInFields = page.locator("input");
  await signInFields.nth(0).fill(input.email);
  await signInFields.nth(1).fill(input.fullName);
  await signInFields.nth(2).fill("demo-password");
  await page.locator("button").nth(1).click();
  await page.locator("button").nth(0).click();

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 15_000,
    })
    .toMatch(/\/app$|\/dashboard$|\/onboarding\/workspace$/);

  if (page.url().endsWith("/onboarding/workspace")) {
    if (options?.createWorkspaceIfNeeded === false) {
      return;
    }

    const onboardingFields = page.locator("input");
    await onboardingFields.nth(0).fill(`${input.fullName} Workspace`);
    await onboardingFields.nth(1).fill(buildWorkspaceSlug(input.email));
    await page.locator("button").nth(0).click();
  }

  await expect(page).toHaveURL(/\/app$|\/dashboard$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("lexframe.dev.access-token"),
      ),
    )
    .toBeTruthy();
}

function buildWorkspaceSlug(email: string) {
  const localPart = email.split("@")[0] ?? "workspace";

  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug.length > 0 ? slug : "workspace";
}
