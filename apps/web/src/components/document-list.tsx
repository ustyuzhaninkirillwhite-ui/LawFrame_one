"use client";

import type {
  DataClassification,
  DocumentKind,
  DocumentListQuery,
  DocumentStatus,
} from "@lexframe/contracts";
import Link from "next/link";
import * as React from "react";
import { ArtifactViewer } from "@/components/artifact-viewer";
import { DocumentClassificationBadge } from "@/components/document-classification-badge";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { DocumentPicker } from "@/components/document-picker";
import { UploadDialog } from "@/components/upload-dialog";
import { useDocuments, useRuns } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatStatus } from "@/lib/i18n";

const kindOptions: ReadonlyArray<DocumentKind | "all"> = [
  "all",
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

const statusOptions: ReadonlyArray<DocumentStatus | "all"> = [
  "all",
  "upload_pending",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "archived",
  "soft_deleted",
];

const classificationOptions: ReadonlyArray<DataClassification | "all"> = [
  "all",
  "client_material",
  "confidential",
  "internal",
  "legal_secret",
  "personal_data",
  "public",
];

export function DocumentList() {
  const runs = useRuns();
  const [search, setSearch] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [kind, setKind] = React.useState<DocumentKind | "all">("all");
  const [status, setStatus] = React.useState<DocumentStatus | "all">("all");
  const [classification, setClassification] = React.useState<
    DataClassification | "all"
  >("all");
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<
    string | null
  >(null);
  const deferredSearch = React.useDeferredValue(search);

  const filters = React.useMemo<DocumentListQuery>(
    () => ({
      q: deferredSearch.trim() || undefined,
      tag: tag.trim() || undefined,
      kind: kind === "all" ? undefined : kind,
      status: status === "all" ? undefined : status,
      classification: classification === "all" ? undefined : classification,
    }),
    [classification, deferredSearch, kind, status, tag],
  );

  const documents = useDocuments(filters);
  const items = React.useMemo(
    () => documents.data?.items ?? [],
    [documents.data?.items],
  );
  const resolvedSelectedDocumentId =
    selectedDocumentId && items.some((item) => item.id === selectedDocumentId)
      ? selectedDocumentId
      : (items[0]?.id ?? null);

  const stats = React.useMemo(
    () => ({
      total: items.length,
      processing: items.filter((document) => document.status === "processing")
        .length,
      templates: items.filter(
        (document) => document.kind === "document_template",
      ).length,
      protected: items.filter(
        (document) => document.classification !== "public",
      ).length,
    }),
    [items],
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">библиотека документов</Badge>
          <CardTitle>Канонические документы и управляемое хранилище</CardTitle>
          <CardDescription>
            Stage 2 переводит документы, шаблоны и workflow artifacts в
            продуктовые сущности с версиями, RLS и signed URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Всего
              </div>
              <div className="mt-3 text-3xl font-[family-name:var(--font-display)]">
                {stats.total}
              </div>
            </div>
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                В обработке
              </div>
              <div className="mt-3 text-3xl font-[family-name:var(--font-display)]">
                {stats.processing}
              </div>
            </div>
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Шаблоны
              </div>
              <div className="mt-3 text-3xl font-[family-name:var(--font-display)]">
                {stats.templates}
              </div>
            </div>
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Защищённые
              </div>
              <div className="mt-3 text-3xl font-[family-name:var(--font-display)]">
                {stats.protected}
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.9fr]">
            <Input
              placeholder="Поиск по названию или описанию"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Input
              placeholder="Фильтр по тегу"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            />
            <select
              className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as DocumentKind | "all")
              }
            >
              {kindOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as DocumentStatus | "all")
              }
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
              value={classification}
              onChange={(event) =>
                setClassification(
                  event.target.value as DataClassification | "all",
                )
              }
            >
              {classificationOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <UploadDialog onUploaded={setSelectedDocumentId} />

          <Card>
            <CardHeader>
              <Badge variant="accent">вид библиотеки</Badge>
              <CardTitle>Документы рабочего пространства</CardTitle>
              <CardDescription>
                Библиотека покрывает фильтры, состояния обработки,
                предупреждения по классификации и переходы в детальный вид.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {documents.isLoading ? (
                <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  Загружаю библиотеку документов…
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  По текущим фильтрам документы не найдены.
                </div>
              ) : (
                items.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-medium">
                          {document.title}
                        </div>
                        <div className="mt-2 text-sm text-[color:var(--muted)]">
                          {document.description ?? "Описание отсутствует."}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <DocumentClassificationBadge
                          classification={document.classification}
                        />
                        <Badge variant="muted">{formatStatus(document.kind)}</Badge>
                        <Badge
                          variant={
                            document.status === "ready"
                              ? "success"
                              : document.status === "processing"
                                ? "accent"
                                : "muted"
                          }
                        >
                          {formatStatus(document.status)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {document.tags.map((tagValue) => (
                        <Badge key={tagValue} variant="muted">
                          #{tagValue}
                        </Badge>
                      ))}
                      {document.currentVersion ? (
                        <Badge
                          variant={
                            document.currentVersion.storageState ===
                            "private_bucket"
                              ? "success"
                              : "accent"
                          }
                        >
                          {formatStatus(document.currentVersion.storageState)}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-[color:var(--muted)]">
                        {document.currentVersion
                          ? `v${document.currentVersion.versionNo} • ${document.currentVersion.originalFilename}`
                          : "Текущая версия отсутствует"}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="text-sm text-[color:var(--accent-strong)] underline"
                          onClick={() => setSelectedDocumentId(document.id)}
                          type="button"
                        >
                          Показать детали
                        </button>
                        <Link
                          className="text-sm text-[color:var(--accent-strong)] underline"
                          href={`/documents/${document.id}`}
                        >
                          Открыть страницу
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <DocumentPicker
            documents={items}
            onSelect={setSelectedDocumentId}
            selectedDocumentId={resolvedSelectedDocumentId}
          />
          {resolvedSelectedDocumentId ? (
            <DocumentDetailPanel documentId={resolvedSelectedDocumentId} />
          ) : null}
        </div>
      </div>

      <ArtifactViewer runId={runs.data?.[0]?.id ?? null} />
    </div>
  );
}
