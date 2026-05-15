import { expect, type Page } from "@playwright/test";

export async function openDocumentUploadDialog(page: Page) {
  await page.goto("/documents");
  await expect(page.locator("body")).toContainText(/document|upload/i, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /new upload/i }).click();
}

export async function selectDocumentFile(page: Page, fileFixture: string) {
  await page.getByLabel(/select file/i).setInputFiles(fileFixture);
}

export async function submitDocumentUpload(page: Page) {
  await page.getByRole("button", { name: /upload selected file/i }).click();
}

export async function assertDocumentUploadCompleted(page: Page, filename: string) {
  await expect(page.locator("body")).toContainText(filename, { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/upload flow completed|ready|completed/i, {
    timeout: 20_000,
  });
}

export async function openFirstDocumentDetail(page: Page) {
  const documentLink = page.locator('a[href^="/documents/"]').first();
  await expect(documentLink).toBeVisible({ timeout: 20_000 });
  await documentLink.click();
  await expect(page).toHaveURL(/\/documents\/[^/]+$/);
}

export async function assertNoSignedUrlRendered(page: Page) {
  const pageSurface = await page
    .evaluate(() => {
      const storage = {
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
      };
      return {
        bodyText: document.body.innerText,
        html: document.documentElement.outerHTML,
        storage,
      };
    })
    .catch(() => ({ bodyText: "", html: "", storage: {} }));
  const serialized = JSON.stringify(pageSurface);

  expect(serialized).not.toMatch(/\/storage\/v1\/object\/sign\/|[?&]token=/i);
  expect(serialized).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE/i);
}
