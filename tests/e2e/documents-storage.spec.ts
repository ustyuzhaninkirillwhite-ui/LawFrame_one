import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

const apiBaseUrl = process.env.LEXFRAME_API_BASE_URL ?? `http://127.0.0.1:${process.env.LEXFRAME_API_PORT ?? "3104"}`;

test.describe("Stage 2 documents / storage smoke", () => {
  test("owner can upload a document, request a preview URL, create a new version and archive/restore it", async ({
    page,
  }) => {
    await signInAsDemo(page, {
      email: `documents-${Date.now()}@lexframe.local`,
      fullName: "Stage2 Documents Owner",
    });

    const result = await page.evaluate(async (baseUrl) => {
      const token = window.localStorage.getItem("lexframe.dev.access-token");
      if (!token) {
        throw new Error("Missing demo access token.");
      }

      const sessionContext = await fetch(`${baseUrl}/session/context`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }).then((response) => response.json());

      const headers = {
        authorization: `Bearer ${token}`,
        "x-workspace-id": sessionContext.activeWorkspace.id,
      };
      const jsonHeaders = {
        ...headers,
        "content-type": "application/json",
      };

      const uploadBytes = new TextEncoder().encode(
        "LexFrame browser storage smoke\n",
      );
      const uploadBase64 = btoa(
        String.fromCharCode(...Array.from(uploadBytes)),
      );

      const uploadIntent = await fetch(`${baseUrl}/documents/upload-intents`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          title: "Stage 2 upload",
          description: "Smoke upload from Playwright",
          kind: "case_material",
          classification: "client_material",
          mimeType: "text/plain",
          originalFilename: "claim.txt",
          sizeBytes: uploadBytes.byteLength,
          tags: ["stage2", "smoke"],
        }),
      }).then((response) => response.json());

      const content = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions/${uploadIntent.versionId}/content`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            contentBase64: uploadBase64,
            clientReportedSize: uploadBytes.byteLength,
            clientReportedMimeType: "text/plain",
          }),
        },
      ).then((response) => response.json());

      await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions/${uploadIntent.versionId}/complete`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            clientReportedSize: uploadBytes.byteLength,
            clientReportedMimeType: "text/plain",
            sha256: content.sha256,
          }),
        },
      );

      const signedUrlResponse = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/signed-url`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            versionId: uploadIntent.versionId,
            objectRole: "original",
            purpose: "download",
          }),
        },
      );
      const signedUrlBody = await signedUrlResponse.json();

      const versionIntent = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions/upload-intent`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            originalFilename: "claim-v2.txt",
            mimeType: "text/plain",
            sizeBytes: uploadBytes.byteLength,
          }),
        },
      ).then((response) => response.json());

      const versionContent = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions/${versionIntent.versionId}/content`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            contentBase64: uploadBase64,
            clientReportedSize: uploadBytes.byteLength,
            clientReportedMimeType: "text/plain",
          }),
        },
      ).then((response) => response.json());

      await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions/${versionIntent.versionId}/complete`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            clientReportedSize: uploadBytes.byteLength,
            clientReportedMimeType: "text/plain",
            sha256: versionContent.sha256,
          }),
        },
      );

      const versions = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/versions`,
        {
          headers,
        },
      ).then((response) => response.json());

      const archive = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/archive`,
        {
          method: "POST",
          headers,
        },
      ).then((response) => response.json());

      const restore = await fetch(
        `${baseUrl}/documents/${uploadIntent.documentId}/restore`,
        {
          method: "POST",
          headers,
        },
      ).then((response) => response.json());

      return {
        documentId: uploadIntent.documentId,
        signedUrlStatus: signedUrlResponse.status,
        signedUrlIssued: typeof signedUrlBody.signedUrl === "string",
        signedUrlErrorCode: signedUrlBody.error?.code,
        versionsCount: versions.length,
        archiveStatus: archive.status,
        restoreStatus: restore.status,
      };
    }, apiBaseUrl);

    expect(result.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    if (result.signedUrlStatus === 200) {
      expect(result.signedUrlIssued).toBe(true);
    } else {
      expect(result.signedUrlStatus).toBe(503);
      expect(result.signedUrlErrorCode).toBe("READINESS_GATE_BLOCKED");
    }
    expect(result.versionsCount).toBeGreaterThanOrEqual(2);
    expect(result.archiveStatus).toBe("archived");
    expect(result.restoreStatus).toBe("restored");
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
  });
});
