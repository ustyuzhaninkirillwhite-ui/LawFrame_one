import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "./document-list";

const mockedDocumentsFixture = {
  items: [
    {
      id: "doc_01hzstage2claim",
      workspaceId: "ws_stage2",
      ownerId: "usr_stage2",
      title: "Claim template for pre-trial package",
      description: "Template description",
      kind: "document_template",
      status: "ready",
      classification: "client_material",
      source: "template_library",
      tags: ["claim"],
      currentVersion: {
        id: "docv_claim_v2",
        documentId: "doc_01hzstage2claim",
        versionNo: 2,
        status: "ready",
        originalFilename: "claim-template-v2.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 294912,
        sha256: null,
        storageState: "private_bucket",
        scanStatus: "clean",
        previewStatus: "ready",
        extractionStatus: "ready",
        createdAt: "2026-04-21T08:10:00.000Z",
        completedAt: "2026-04-21T08:12:00.000Z",
      },
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-21T08:12:00.000Z",
      archivedAt: null,
      deletedAt: null,
    },
    {
      id: "doc_01hzresearch",
      workspaceId: "ws_stage2",
      ownerId: "usr_stage2",
      title: "Case law research for A40-101/2026",
      description: "Research package",
      kind: "case_material",
      status: "processing",
      classification: "confidential",
      source: "user_upload",
      tags: ["research"],
      currentVersion: {
        id: "docv_research_v1",
        documentId: "doc_01hzresearch",
        versionNo: 1,
        status: "processing",
        originalFilename: "case-law-research.pdf",
        mimeType: "application/pdf",
        sizeBytes: 516096,
        sha256: null,
        storageState: "signed_url_only",
        scanStatus: "queued",
        previewStatus: "queued",
        extractionStatus: "queued",
        createdAt: "2026-04-21T08:30:00.000Z",
        completedAt: null,
      },
      createdAt: "2026-04-21T08:30:00.000Z",
      updatedAt: "2026-04-21T08:30:30.000Z",
      archivedAt: null,
      deletedAt: null,
    },
  ],
  nextCursor: null,
};

vi.mock("@/hooks/use-stage0-data", () => ({
  useDocuments: () => ({
    data: mockedDocumentsFixture,
    isLoading: false,
  }),
  useRuns: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("./upload-dialog", () => ({
  UploadDialog: () => <div>upload dialog</div>,
}));

vi.mock("./document-picker", () => ({
  DocumentPicker: ({
    selectedDocumentId,
  }: {
    readonly selectedDocumentId?: string | null;
  }) => <div>picker: {selectedDocumentId}</div>,
}));

vi.mock("./artifact-viewer", () => ({
  ArtifactViewer: () => <div>artifact viewer</div>,
}));

vi.mock("./document-detail-panel", () => ({
  DocumentDetailPanel: ({ documentId }: { readonly documentId: string }) => (
    <div>detail for {documentId}</div>
  ),
}));

describe("DocumentList", () => {
  it("renders the library and switches selected detail", () => {
    render(<DocumentList />);

    expect(screen.getByText("Документы рабочего пространства")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Поиск по названию или описанию"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Claim template for pre-trial package"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/detail for doc_01hzstage2claim/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Показать детали" })[1]!);

    expect(screen.getByText(/detail for doc_01hzresearch/)).toBeInTheDocument();
  });
});
