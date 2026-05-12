import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadDialog } from "./upload-dialog";

const createDocumentUploadIntent = vi.fn();
const completeDocumentUpload = vi.fn();
const uploadDocumentVersionContent = vi.fn();

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createDocumentUploadIntent,
      completeDocumentUpload,
      uploadDocumentVersionContent,
    },
    sessionContext: {
      permissions: ["document.upload"],
    },
  }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("UploadDialog", () => {
  it("uploads selected file bytes before completing the upload contract", async () => {
    const file = new File(["hello"], "evidence.txt", { type: "text/plain" });
    createDocumentUploadIntent.mockResolvedValue({
      documentId: "doc_uploaded",
      versionId: "docv_uploaded",
      bucket: "documents-private",
      storagePath:
        "workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/evidence.txt",
      uploadMethod: "direct",
      maxSizeBytes: 25 * 1024 * 1024,
      allowedMimeTypes: ["text/plain"],
      expiresAt: "2026-04-21T12:00:00.000Z",
    });
    uploadDocumentVersionContent.mockResolvedValue({
      sha256:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });
    completeDocumentUpload.mockResolvedValue({});

    renderWithQueryClient(<UploadDialog />);

    fireEvent.click(screen.getByRole("button", { name: "New upload" }));
    fireEvent.change(screen.getByLabelText("Select file"), {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload selected file" }),
    );

    await waitFor(() => {
      expect(createDocumentUploadIntent).toHaveBeenCalledTimes(1);
    });

    expect(createDocumentUploadIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: "evidence.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      }),
    );
    await waitFor(() => {
      expect(uploadDocumentVersionContent).toHaveBeenCalledWith(
        "doc_uploaded",
        "docv_uploaded",
        expect.objectContaining({
          contentBase64: "aGVsbG8=",
          clientReportedMimeType: "text/plain",
          clientReportedSize: 5,
        }),
      );
    });
    expect(completeDocumentUpload).toHaveBeenCalledWith(
      "doc_uploaded",
      "docv_uploaded",
      {
        clientReportedSize: 5,
        clientReportedMimeType: "text/plain",
        sha256:
          "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      },
    );

    expect(
      await screen.findByText("Upload flow completed for doc_uploaded."),
    ).toBeInTheDocument();
  });
});
