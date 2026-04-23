import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadDialog } from "./upload-dialog";

const createDocumentUploadIntent = vi.fn();
const completeDocumentUpload = vi.fn();

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createDocumentUploadIntent,
      completeDocumentUpload,
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
  it("creates an upload intent and completes the upload contract", async () => {
    createDocumentUploadIntent.mockResolvedValue({
      documentId: "doc_uploaded",
      versionId: "docv_uploaded",
      bucket: "documents-private",
      storagePath:
        "workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/demo.pdf",
      uploadMethod: "direct",
      maxSizeBytes: 25 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
      expiresAt: "2026-04-21T12:00:00.000Z",
    });
    completeDocumentUpload.mockResolvedValue({});

    renderWithQueryClient(<UploadDialog />);

    fireEvent.click(screen.getByRole("button", { name: "New upload" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Issue intent and complete" }),
    );

    await waitFor(() => {
      expect(createDocumentUploadIntent).toHaveBeenCalledTimes(1);
    });

    expect(completeDocumentUpload).toHaveBeenCalledWith(
      "doc_uploaded",
      "docv_uploaded",
      {
        clientReportedSize: 327680,
        clientReportedMimeType: "application/pdf",
      },
    );

    expect(
      await screen.findByText("Upload flow completed for doc_uploaded."),
    ).toBeInTheDocument();
  });
});
