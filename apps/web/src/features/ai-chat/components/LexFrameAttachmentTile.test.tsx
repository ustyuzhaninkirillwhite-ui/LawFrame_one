import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LexFrameAttachmentTile } from "./LexFrameAttachmentTile";

describe("LexFrameAttachmentTile", () => {
  it("renders attachment metadata without exposing storage or signed URL values", () => {
    render(
      <LexFrameAttachmentTile
        attachment={{
          id: "attachment_1",
          sourceType: "uploaded_file",
          sourceId: "attachment_1",
          mode: "thread_attachment",
          classification: "workspace_internal",
          citationRequired: false,
          originalFilename: "evidence.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1200,
          status: "attached",
          downloadPath: "/chat/attachments/attachment_1/download",
          storageKey:
            "workspaces/ws/chat/thread/attachment_1-evidence.pdf?token=signed",
          metadata: {
            sha256: "sha256:file",
          },
        }}
      />,
    );

    expect(screen.getByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByText(/thread|вложение|attachment/i)).toBeInTheDocument();
    expect(screen.queryByText(/token=signed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/workspaces\/ws\/chat/)).not.toBeInTheDocument();
  });
});
