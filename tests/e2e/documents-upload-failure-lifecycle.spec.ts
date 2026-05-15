import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoSignedUrlRendered } from "./utils/documents";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

const textBytes = Buffer.from("LexFrame document lifecycle fixture\n", "utf8");
const textSha256 = createHash("sha256").update(textBytes).digest("hex");

test.describe("documents upload failure lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `part5-documents-upload-${Date.now()}@lexframe.local`,
      fullName: "Part5 Documents Upload",
    });
  });

  test("blocks completion before content and recovers without phantom versions", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };
    const filename = `part5-lifecycle-${Date.now()}.txt`;

    const intentResponse = await request.post(
      `${session.apiBaseUrl}/documents/upload-intents`,
      {
        headers,
        data: {
          title: "Part5 lifecycle guard",
          kind: "case_material",
          classification: "confidential",
          originalFilename: filename,
          mimeType: "text/plain",
          sizeBytes: textBytes.length,
          tags: ["part5", "upload-lifecycle"],
        },
      },
    );
    expect(intentResponse.ok(), await intentResponse.text()).toBeTruthy();
    const intent = (await intentResponse.json()) as {
      readonly documentId: string;
      readonly versionId: string;
    };

    const prematureComplete = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers,
        data: {
          clientReportedSize: textBytes.length,
          clientReportedMimeType: "text/plain",
          sha256: textSha256,
        },
      },
    );
    expect(prematureComplete.status()).toBe(409);
    expect(await prematureComplete.text()).toMatch(/DOCUMENT_UPLOAD_NOT_READY/);

    const metadataMismatch = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/content`,
      {
        headers,
        data: {
          contentBase64: textBytes.toString("base64"),
          clientReportedSize: textBytes.length,
          clientReportedMimeType: "application/pdf",
          sha256: textSha256,
        },
      },
    );
    expect(metadataMismatch.status()).toBe(400);
    expect(await metadataMismatch.text()).toMatch(
      /DOCUMENT_UPLOAD_METADATA_MISMATCH/,
    );

    const contentResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/content`,
      {
        headers,
        data: {
          contentBase64: textBytes.toString("base64"),
          clientReportedSize: textBytes.length,
          clientReportedMimeType: "text/plain",
          sha256: textSha256,
        },
      },
    );
    expect(contentResponse.ok(), await contentResponse.text()).toBeTruthy();

    const wrongHashComplete = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers,
        data: {
          clientReportedSize: textBytes.length,
          clientReportedMimeType: "text/plain",
          sha256: "0".repeat(64),
        },
      },
    );
    expect(wrongHashComplete.status()).toBe(400);
    expect(await wrongHashComplete.text()).toMatch(
      /DOCUMENT_UPLOAD_HASH_MISMATCH/,
    );

    const completeResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers,
        data: {
          clientReportedSize: textBytes.length,
          clientReportedMimeType: "text/plain",
          sha256: textSha256,
        },
      },
    );
    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();

    const versionsResponse = await request.get(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions`,
      { headers: session.headers },
    );
    expect(versionsResponse.ok(), await versionsResponse.text()).toBeTruthy();
    const versions = (await versionsResponse.json()) as readonly unknown[];
    expect(versions).toHaveLength(1);

    await page.goto("/documents");
    await assertRouteReady(page, "documents");
    await expect(page.locator("body")).toContainText(filename, {
      timeout: 20_000,
    });
    await page.goto(`/documents/${intent.documentId}`);
    await expect(page.locator("body")).toContainText(filename, {
      timeout: 20_000,
    });
    await assertNoSignedUrlRendered(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});
