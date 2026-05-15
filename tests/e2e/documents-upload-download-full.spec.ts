import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoSignedUrlRendered } from "./utils/documents";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoProjectFlowSecurityLeaks, installNetworkSecurityAssertions } from "./utils/network-assertions";

const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@block3 documents upload and download", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-documents-${Date.now()}@lexframe.local`,
      fullName: "Block3 Documents User",
    });
  });

  test("covers bytes, hash, complete, detail, signed-url and negative upload metadata", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const pdfBytes = await readFile(path.join(fixturesDir, "minimal.pdf"));
    const sha256 = createHash("sha256").update(pdfBytes).digest("hex");
    const filename = `block3-minimal-${Date.now()}.pdf`;
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };

    const intentResponse = await request.post(`${session.apiBaseUrl}/documents/upload-intents`, {
      headers,
      data: {
        title: "Block3 minimal PDF",
        description: "Block3 upload/download contract",
        kind: "case_material",
        classification: "confidential",
        originalFilename: filename,
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.length,
        tags: ["block3", "documents"],
      },
    });
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
          sha256,
        },
      },
    );
    expect(contentResponse.ok(), await contentResponse.text()).toBeTruthy();
    const content = (await contentResponse.json()) as { readonly sha256: string };
    expect(content.sha256).toBe(sha256);

    const completeResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers,
        data: {
          clientReportedSize: pdfBytes.length,
          clientReportedMimeType: "application/pdf",
          sha256,
        },
      },
    );
    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();

    const listResponse = await request.get(`${session.apiBaseUrl}/documents`, {
      headers: session.headers,
    });
    expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
    const list = (await listResponse.json()) as {
      readonly items?: readonly { readonly id: string; readonly originalFilename?: string | null }[];
    };
    expect(JSON.stringify(list)).toContain(intent.documentId);

    const detailResponse = await request.get(
      `${session.apiBaseUrl}/documents/${intent.documentId}`,
      { headers: session.headers },
    );
    expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
    const detail = await detailResponse.json();
    expect(JSON.stringify(detail)).toContain(filename);
    expect(JSON.stringify(detail)).toContain("application/pdf");
    expect(JSON.stringify(detail)).toContain(String(pdfBytes.length));

    const signedUrlResponse = await request.post(
      `${session.apiBaseUrl}/documents/${intent.documentId}/signed-url`,
      {
        headers,
        data: {
          versionId: intent.versionId,
          objectRole: "original",
          purpose: "download",
          expiresInSeconds: 60,
        },
      },
    );
    expect(signedUrlResponse.status()).toBeLessThan(500);
    const signedUrlBody = await signedUrlResponse.text();
    expect(signedUrlBody).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE|BEGIN PRIVATE KEY/i);

    for (const badPayload of [
      {
        originalFilename: "empty.txt",
        mimeType: "text/plain",
        sizeBytes: 0,
        expected: /VALIDATION_ERROR|EMPTY_FILE/i,
      },
      {
        originalFilename: "payload.exe",
        mimeType: "application/pdf",
        sizeBytes: 10,
        expected: /UNSUPPORTED_FILE_EXTENSION|VALIDATION_ERROR/i,
      },
      {
        originalFilename: "../escape.txt",
        mimeType: "text/plain",
        sizeBytes: 10,
        expected: /UNSAFE_FILENAME|VALIDATION_ERROR/i,
      },
      {
        originalFilename: "unsupported.bin",
        mimeType: "application/x-msdownload",
        sizeBytes: 10,
        expected: /UNSUPPORTED_MIME_TYPE|VALIDATION_ERROR/i,
      },
    ]) {
      const negativeResponse = await request.post(
        `${session.apiBaseUrl}/documents/upload-intents`,
        {
          headers,
          data: {
            title: `Block3 negative ${badPayload.originalFilename}`,
            kind: "case_material",
            classification: "confidential",
            ...badPayload,
          },
        },
      );
      expect(negativeResponse.status()).toBeGreaterThanOrEqual(400);
      expect(negativeResponse.status()).toBeLessThan(500);
      expect(await negativeResponse.text()).toMatch(badPayload.expected);
    }

    await page.goto("/documents");
    await assertRouteReady(page, "documents");
    await expect(page.locator("body")).toContainText(filename, { timeout: 20_000 });
    await page.goto(`/documents/${intent.documentId}`);
    await expect(page.locator("body")).toContainText(filename, { timeout: 20_000 });
    await expect(page.locator("body")).toContainText(/application\/pdf|PDF/i);
    await assertNoSignedUrlRendered(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
