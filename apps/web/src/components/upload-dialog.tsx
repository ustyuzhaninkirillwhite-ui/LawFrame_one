"use client";

import type {
  DataClassification,
  DocumentKind,
  DocumentUploadIntentRequest,
} from "@lexframe/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const kindOptions: readonly DocumentKind[] = [
  "case_material",
  "evidence",
  "legal_source",
  "document_template",
  "generated_document",
  "draft_document",
  "delivery_attachment",
  "profile_clause",
  "other",
];

const classificationOptions: readonly DataClassification[] = [
  "client_material",
  "confidential",
  "internal",
  "legal_secret",
  "personal_data",
  "public",
];

const mimeOptions = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
] as const;

interface UploadDialogProps {
  readonly onUploaded?: (documentId: string) => void;
}

export function UploadDialog({ onUploaded }: UploadDialogProps) {
  const queryClient = useQueryClient();
  const { apiClient, sessionContext } = useSessionBridge();
  const canUpload = sessionContext.permissions.includes("document.upload");
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastDocumentId, setLastDocumentId] = React.useState<string | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [form, setForm] = React.useState({
    title: "New evidence package",
    description: "Stage 2 demo upload contract",
    kind: "case_material" as DocumentKind,
    classification: "confidential" as DataClassification,
    originalFilename: "evidence-package.pdf",
    mimeType: "application/pdf",
    sizeBytes: "327680",
    tags: "stage2,upload",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!selectedFile) {
        throw new Error("Select a file before starting upload.");
      }
      const sizeBytes = Number(form.sizeBytes);
      const payload: DocumentUploadIntentRequest = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        classification: form.classification,
        originalFilename: form.originalFilename.trim(),
        mimeType: form.mimeType,
        sizeBytes,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      const intent = await apiClient.createDocumentUploadIntent(payload);
      const content = await apiClient.uploadDocumentVersionContent(
        intent.documentId,
        intent.versionId,
        {
          contentBase64: await fileToBase64(selectedFile),
          clientReportedSize: sizeBytes,
          clientReportedMimeType: form.mimeType,
        },
      );
      await apiClient.completeDocumentUpload(
        intent.documentId,
        intent.versionId,
        {
          clientReportedSize: sizeBytes,
          clientReportedMimeType: form.mimeType,
          sha256: content.sha256,
        },
      );

      setLastDocumentId(intent.documentId);
      setSelectedFile(null);
      setOpen(false);
      onUploaded?.(intent.documentId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({
          queryKey: ["document-detail", intent.documentId],
        }),
      ]);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось завершить upload flow.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!canUpload) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="muted">upload gated</Badge>
          <CardTitle>Upload requires backend permission</CardTitle>
          <CardDescription>
            В текущем workspace у пользователя нет `document.upload`.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="accent">hybrid upload</Badge>
            <CardTitle className="mt-2">Create document contract</CardTitle>
            <CardDescription>
              В demo-режиме форма закрывает intent и completion подряд, чтобы UI
              работал поверх stage2 API shape.
            </CardDescription>
          </div>
          <Button
            onClick={() => setOpen((current) => !current)}
            variant={open ? "ghost" : "default"}
          >
            {open ? "Hide form" : "New upload"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastDocumentId ? (
          <div className="rounded-[18px] border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-4 py-3 text-sm text-[color:var(--success)]">
            Upload flow completed for {lastDocumentId}.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        ) : null}

        {open ? (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-3 lg:grid-cols-2">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Document title"
              />
              <Input
                value={form.originalFilename}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    originalFilename: event.target.value,
                  }))
                }
                placeholder="evidence-package.pdf"
              />
            </div>

            <label className="grid gap-2 rounded-[18px] border border-[color:var(--line)] bg-white/3 p-3 text-sm">
              <span className="text-[color:var(--muted-strong)]">
                Select file
              </span>
              <input
                type="file"
                aria-label="Select file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (!file) {
                    return;
                  }
                  setForm((current) => ({
                    ...current,
                    title:
                      current.title === "New evidence package"
                        ? file.name.replace(/\.[^.]+$/, "") || file.name
                        : current.title,
                    originalFilename: file.name,
                    mimeType: file.type || "application/octet-stream",
                    sizeBytes: String(file.size),
                  }));
                }}
              />
              {selectedFile ? (
                <span className="text-xs text-[color:var(--muted)]">
                  {selectedFile.name} · {selectedFile.size} bytes
                </span>
              ) : null}
            </label>

            <textarea
              className="min-h-24 rounded-[22px] border border-[color:var(--line)] bg-white/4 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)]"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
            />

            <div className="grid gap-3 lg:grid-cols-4">
              <select
                className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as DocumentKind,
                  }))
                }
              >
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>

              <select
                className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                value={form.classification}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    classification: event.target.value as DataClassification,
                  }))
                }
              >
                {classificationOptions.map((classification) => (
                  <option key={classification} value={classification}>
                    {classification}
                  </option>
                ))}
              </select>

              <select
                className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                value={form.mimeType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mimeType: event.target.value,
                  }))
                }
              >
                {mimeOptions.map((mimeType) => (
                  <option key={mimeType} value={mimeType}>
                    {mimeType}
                  </option>
                ))}
              </select>

              <Input
                inputMode="numeric"
                value={form.sizeBytes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sizeBytes: event.target.value,
                  }))
                }
                placeholder="327680"
              />
            </div>

            <Input
              value={form.tags}
              onChange={(event) =>
                setForm((current) => ({ ...current, tags: event.target.value }))
              }
              placeholder="stage2,upload"
            />

            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting ? "Uploading..." : "Upload selected file"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function fileToBase64(file: File): Promise<string> {
  if (typeof file.arrayBuffer !== "function") {
    return fileToBase64WithReader(file);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function fileToBase64WithReader(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
