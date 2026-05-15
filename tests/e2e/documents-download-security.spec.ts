import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoSignedUrlRendered } from "./utils/documents";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";

const pdfBytes = Buffer.from("%PDF-1.4\n% LexFrame part5\n%%EOF\n", "utf8");
const pdfSha256 = createHash("sha256").update(pdfBytes).digest("hex");

test.describe("documents download security", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `part5-documents-download-${Date.now()}@lexframe.local`,
      fullName: "Part5 Documents Download",
    });
  });

  test("keeps signed download URL out of DOM and browser storage", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };
    const filename = `part5-download-${Date.now()}.pdf`;

    const intentResponse = await request.post(
      `${session.apiBaseUrl}/documents/upload-intents`,
      {
        headers,
        data: {
          title: "Part5 download security",
          kind: "case_material",
          classification: "client_material",
          originalFilename: filename,
          mimeType: "application/pdf",
          sizeBytes: pdfBytes.length,
          tags: ["part5", "download-security"],
        },
      },
    );
    expect(intentResponse.ok(), await intentResponse.text()).toBeTruthy();
    const intent = (await intentResponse.json()) as {
      readonly documentId: string;
      readonly versionId: string;
    };

    const contentResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/content`,
      {
        headers,
        data: {
          contentBase64: pdfBytes.toString("base64"),
          clientReportedSize: pdfBytes.length,
          clientReportedMimeType: "application/pdf",
          sha256: pdfSha256,
        },
      },
    );
    expect(contentResponse.ok(), await contentResponse.text()).toBeTruthy();

    const completeResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers,
        data: {
          clientReportedSize: pdfBytes.length,
          clientReportedMimeType: "application/pdf",
          sha256: pdfSha256,
        },
      },
    );
    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();

    await page.goto(`/documents/${intent.documentId}`);
    await expect(page.locator("body")).toContainText(filename, {
      timeout: 20_000,
    });
    await assertNoSignedUrlRendered(page);

    const signedUrlResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/documents/${intent.documentId}/signed-url`) &&
        response.request().method() === "POST",
    );
    await page.getByTestId("document-preview-request-signed-url").click();
    const response = await signedUrlResponse;
    expect(response.status()).toBe(200);

    await assertNoSignedUrlRendered(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});
