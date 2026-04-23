import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import { expectReadinessProfile } from "./helpers/readiness";

test.describe("Stage 2 storage integrated smoke", () => {
  test("local-integrated issues a real signed URL with ttl and blocks it after archive", async ({
    browser,
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `storage-integrated-${Date.now()}@lexframe.local`,
      fullName: "Stage2 Storage Integrated",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    const session = await getWorkspaceApiSession(page, request);
    const jsonHeaders = {
      ...session.headers,
      "content-type": "application/json",
    };

    const uploadIntentResponse = await request.post(
      `${session.apiBaseUrl}/documents/upload-intents`,
      {
        headers: jsonHeaders,
        data: {
          title: "Stage 2 integrated upload",
          description: "Strict integrated storage smoke",
          kind: "case_material",
          classification: "client_material",
          mimeType: "application/pdf",
          originalFilename: "integrated-claim.pdf",
          sizeBytes: 196608,
          tags: ["stage2", "integrated"],
        },
      },
    );
    expect(uploadIntentResponse.ok()).toBeTruthy();
    const uploadIntent = await uploadIntentResponse.json();

    const completeResponse = await request.post(
      `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/versions/${uploadIntent.versionId}/complete`,
      {
        headers: jsonHeaders,
        data: {
          clientReportedSize: 196608,
          clientReportedMimeType: "application/pdf",
        },
      },
    );
    expect(completeResponse.ok()).toBeTruthy();

    const signedUrlResponse = await request.post(
      `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/signed-url`,
      {
        headers: jsonHeaders,
        data: {
          versionId: uploadIntent.versionId,
          objectRole: "preview_pdf",
          purpose: "preview",
          expiresInSeconds: 9999,
        },
      },
    );
    expect(signedUrlResponse.status()).toBe(200);
    const signedUrlBody = await signedUrlResponse.json();
    expect(signedUrlBody.signedUrl).toContain("storage");
    expect(signedUrlBody.ttlSeconds).toBeGreaterThan(0);

    const auditResponse = await request.get(
      `${session.apiBaseUrl}/admin/security/audit-events`,
      {
        headers: session.headers,
      },
    );
    expect(auditResponse.ok()).toBeTruthy();
    const auditEvents = (await auditResponse.json()) as Array<{
      readonly action?: string;
      readonly metadata?: unknown;
    }>;
    const signedUrlAudit = auditEvents.find(
      (event) => event.action === "document.signed_url.issued",
    );
    expect(signedUrlAudit).toBeTruthy();
    const auditMetadata = JSON.stringify(signedUrlAudit?.metadata ?? {});
    expect(auditMetadata).not.toContain("signedUrl");
    expect(auditMetadata).not.toContain("signedURL");
    expect(auditMetadata).not.toContain("token=");

    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    try {
      await signInAsDemo(foreignPage, {
        email: `storage-foreign-${Date.now()}@lexframe.local`,
        fullName: "Stage2 Foreign Workspace",
      });
      const foreignSession = await getWorkspaceApiSession(foreignPage, request);
      const foreignSignedUrlResponse = await request.post(
        `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/signed-url`,
        {
          headers: {
            ...foreignSession.headers,
            "content-type": "application/json",
          },
          data: {
            versionId: uploadIntent.versionId,
            objectRole: "preview_pdf",
            purpose: "preview",
          },
        },
      );
      expect([403, 404]).toContain(foreignSignedUrlResponse.status());
    } finally {
      await foreignContext.close();
    }

    const archiveResponse = await request.post(
      `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/archive`,
      {
        headers: session.headers,
      },
    );
    expect(archiveResponse.ok()).toBeTruthy();

    const blockedSignedUrlResponse = await request.post(
      `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/signed-url`,
      {
        headers: jsonHeaders,
        data: {
          versionId: uploadIntent.versionId,
          objectRole: "preview_pdf",
          purpose: "preview",
        },
      },
    );
    expect(blockedSignedUrlResponse.status()).toBe(409);
    const blockedBody = await blockedSignedUrlResponse.json();
    expect(blockedBody.error?.code).toBe("DOCUMENT_STATE_INVALID");
  });
});
