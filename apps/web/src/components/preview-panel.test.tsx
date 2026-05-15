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
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
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

    fireEvent.click(screen.getByTestId("document-preview-request-signed-url"));

    await waitFor(() => {
      expect(createDocumentSignedUrl).toHaveBeenCalledTimes(1);
    });

    const openButton = screen.getByTestId("document-preview-open-signed-url");
    expect(openButton).not.toHaveAttribute("href");
    fireEvent.click(openButton);
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/preview.pdf",
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Обновить ссылку" }),
    );

    await waitFor(() => {
      expect(createDocumentSignedUrl).toHaveBeenCalledTimes(2);
    });
  });
});
