"use client";

import type { DocumentSummary } from "@lexframe/contracts";
import { DocumentClassificationBadge } from "@/components/document-classification-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatStatus } from "@/lib/i18n";

interface DocumentPickerProps {
  readonly documents: readonly DocumentSummary[];
  readonly selectedDocumentId?: string | null;
  readonly onSelect: (documentId: string) => void;
}

export function DocumentPicker({
  documents,
  selectedDocumentId,
  onSelect,
}: DocumentPickerProps) {
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">выбор документа</Badge>
        <CardTitle>Канонический выбор</CardTitle>
        <CardDescription>
          Следующие этапы автоматизации и RAG должны выбирать сущность
          документа, а не сырой ключ хранилища.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Нет документов для выбора.
          </div>
        ) : (
          <>
            <select
              className="h-11 w-full rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
              value={selectedDocumentId ?? ""}
              onChange={(event) => onSelect(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </select>

            {selectedDocument ? (
              <div className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-[color:var(--foreground)]">
                    {selectedDocument.title}
                  </div>
                  <DocumentClassificationBadge
                    classification={selectedDocument.classification}
                  />
                  <Badge variant="muted">{formatStatus(selectedDocument.status)}</Badge>
                </div>
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  {selectedDocument.currentVersion
                    ? `${selectedDocument.currentVersion.originalFilename} • v${selectedDocument.currentVersion.versionNo}`
                    : "Текущая версия отсутствует"}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
