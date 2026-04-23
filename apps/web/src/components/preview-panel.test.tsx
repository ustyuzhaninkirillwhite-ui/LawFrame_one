import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewPanel } from "./preview-panel";

const createDocumentSignedUrl = vi.fn();

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createDocumentSignedUrl,
    },
  }),
}));

describe("PreviewPanel", () => {
  it("requests and refreshes a signed URL without a reload", async () => {
    createDocumentSignedUrl.mockResolvedValue({
      documentId: "doc_preview",
      versionId: "docv_preview",
      objectRole: "preview_pdf",
      signedUrl: "https://example.com/preview.pdf",
      expiresAt: "2099-04-21T12:00:00.000Z",
    });

    render(
      <PreviewPanel
        documentId="doc_preview"
        preferredRole="preview_pdf"
        versionId="docv_preview"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Запросить подписанную ссылку" }));

    await waitFor(() => {
      expect(createDocumentSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("link", { name: "Открыть ссылку" })).toHaveAttribute(
      "href",
      "https://example.com/preview.pdf",
    );

    fireEvent.click(screen.getByRole("button", { name: "Обновить ссылку" }));

    await waitFor(() => {
      expect(createDocumentSignedUrl).toHaveBeenCalledTimes(2);
    });
  });
});
