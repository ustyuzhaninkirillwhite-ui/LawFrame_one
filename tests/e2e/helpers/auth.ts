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
  await waitForSignInReady(page);
  await page.getByTestId("sign-in-email").fill(input.email);
  await page.getByTestId("sign-in-full-name").fill(input.fullName);
  await page.getByTestId("sign-in-password").fill("demo-password");
  await page.getByTestId("sign-in-submit").click();

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 15_000,
    })
    .toMatch(/\/app(?:\/.*)?$|\/dashboard$|\/onboarding\/workspace$/);

  if (page.url().endsWith("/onboarding/workspace")) {
    if (options?.createWorkspaceIfNeeded === false) {
      return;
    }

    await completeWorkspaceOnboarding(page, input);
  }

  await expect(page).toHaveURL(/\/app(?:\/.*)?$|\/dashboard$/, {
    timeout: 15_000,
  });
  await expect
    .poll(() =>
      page
        .evaluate(() =>
          window.localStorage.getItem("lexframe.dev.access-token"),
        )
        .catch(() => null),
    )
    .toBeTruthy();
}

async function completeWorkspaceOnboarding(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
  },
) {
  await page
    .getByTestId("onboarding-workspace-name")
    .fill(`${input.fullName} Workspace`);
  await page
    .getByTestId("onboarding-workspace-slug")
    .fill(buildWorkspaceSlug(input.email));

  const createButton = page.getByTestId("onboarding-workspace-submit");
  await expect(createButton).toBeVisible({ timeout: 10_000 });
  await expect(createButton).toBeEnabled({ timeout: 10_000 });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const workspaceResponse = page
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/workspaces"),
        { timeout: 5_000 },
      )
      .catch(() => null);

    await createButton.click();
    const response = await workspaceResponse;
    if (response) {
      expect(response.status(), await response.text()).toBeLessThan(400);
      return;
    }

    if (!page.url().endsWith("/onboarding/workspace")) {
      return;
    }

    if (!(await createButton.isEnabled().catch(() => false))) {
      return;
    }
  }
}

async function waitForSignInReady(page: Page) {
  await expect(page.getByTestId("sign-in-email")).toBeVisible({
    timeout: 15_000,
  });
  await page
    .waitForFunction(
      () => {
        const lexframeWindow = window as Window & {
          __LEXFRAME_MSW_READY?: boolean;
        };

        return lexframeWindow.__LEXFRAME_MSW_READY === true;
      },
      undefined,
      {
        timeout: 15_000,
      },
    )
    .catch(() => undefined);
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
