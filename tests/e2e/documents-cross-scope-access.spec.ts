import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { assertNoSignedUrlRendered } from "./utils/documents";
import { installConsoleGuards } from "./utils/console";

const bytes = Buffer.from("LexFrame cross scope document\n", "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");

test.describe("documents cross-scope access", () => {
  test("blocks forced document detail and signed-url access from another workspace", async ({
    browser,
    page,
    request,
  }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `part5-documents-owner-${Date.now()}@lexframe.local`,
      fullName: "Part5 Documents Owner",
    });
    const ownerSession = await getWorkspaceApiSession(page, request);
    const ownerHeaders = {
      ...ownerSession.headers,
      "content-type": "application/json",
    };
    const filename = `part5-cross-scope-${Date.now()}.txt`;

    const intentResponse = await request.post(
      `${ownerSession.apiBaseUrl}/documents/upload-intents`,
      {
        headers: ownerHeaders,
        data: {
          title: "Part5 cross scope guard",
          kind: "case_material",
          classification: "confidential",
          originalFilename: filename,
          mimeType: "text/plain",
          sizeBytes: bytes.length,
          tags: ["part5", "cross-scope"],
        },
      },
    );
    expect(intentResponse.ok(), await intentResponse.text()).toBeTruthy();
    const intent = (await intentResponse.json()) as {
      readonly documentId: string;
      readonly versionId: string;
    };

    const contentResponse = await request.post(
      `${ownerSession.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/content`,
      {
        headers: ownerHeaders,
        data: {
          contentBase64: bytes.toString("base64"),
          clientReportedSize: bytes.length,
          clientReportedMimeType: "text/plain",
          sha256,
        },
      },
    );
    expect(contentResponse.ok(), await contentResponse.text()).toBeTruthy();

    const completeResponse = await request.post(
      `${ownerSession.apiBaseUrl}/documents/${intent.documentId}/versions/${intent.versionId}/complete`,
      {
        headers: ownerHeaders,
        data: {
          clientReportedSize: bytes.length,
          clientReportedMimeType: "text/plain",
          sha256,
        },
      },
    );
    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();

    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    try {
      installConsoleGuards(foreignPage);
      await signInAsDemo(foreignPage, {
        email: `part5-documents-foreign-${Date.now()}@lexframe.local`,
        fullName: "Part5 Documents Foreign",
      });
      const foreignSession = await getWorkspaceApiSession(foreignPage, request);

      const foreignDetail = await request.get(
        `${ownerSession.apiBaseUrl}/documents/${intent.documentId}`,
        { headers: foreignSession.headers },
      );
      expect([403, 404]).toContain(foreignDetail.status());

      const foreignSignedUrl = await request.post(
        `${ownerSession.apiBaseUrl}/documents/${intent.documentId}/signed-url`,
        {
          headers: {
            ...foreignSession.headers,
            "content-type": "application/json",
          },
          data: {
            versionId: intent.versionId,
            objectRole: "original",
            purpose: "download",
          },
        },
      );
      expect([403, 404]).toContain(foreignSignedUrl.status());

      await foreignPage.goto(`/documents/${intent.documentId}`);
      await expect(foreignPage.locator("body")).not.toContainText(filename);
      await assertNoSignedUrlRendered(foreignPage);
    } finally {
      await foreignContext.close();
    }
  });
});
