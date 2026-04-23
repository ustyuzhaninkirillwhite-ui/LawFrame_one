"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import {
  useDocumentDetail,
  useDocumentVersions,
} from "@/hooks/use-stage0-data";
import { useSessionBridge } from "@/providers/session-provider";
import { DocumentClassificationBadge } from "@/components/document-classification-badge";
import { PreviewPanel } from "@/components/preview-panel";
import { ProcessingStatusCard } from "@/components/processing-status-card";
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
import { formatStatus } from "@/lib/i18n";

interface DocumentDetailPanelProps {
  readonly documentId: string;
}

export function DocumentDetailPanel({ documentId }: DocumentDetailPanelProps) {
  const queryClient = useQueryClient();
  const { apiClient, sessionContext } = useSessionBridge();
  const detail = useDocumentDetail(documentId);
  const versions = useDocumentVersions(documentId);
  const [submittingAction, setSubmittingAction] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [versionForm, setVersionForm] = React.useState({
    originalFilename: "next-version.pdf",
    mimeType: "application/pdf",
    sizeBytes: "196608",
  });

  const currentVersion = detail.data?.currentVersion ?? null;
  const currentVersionJobs = React.useMemo(
    () =>
      (detail.data?.processingJobs ?? []).filter(
        (job) => job.versionId === currentVersion?.id,
      ),
    [currentVersion?.id, detail.data?.processingJobs],
  );

  async function reloadDocumentQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
      queryClient.invalidateQueries({
        queryKey: ["document-detail", documentId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["document-versions", documentId],
      }),
      queryClient.invalidateQueries({ queryKey: ["run-artifacts"] }),
    ]);
  }

  async function runDocumentAction(action: "archive" | "restore" | "delete") {
    setSubmittingAction(action);
    setError(null);

    try {
      if (action === "archive") {
        await apiClient.archiveDocument(documentId);
      } else if (action === "restore") {
        await apiClient.restoreDocument(documentId);
      } else {
        await apiClient.deleteDocument(documentId);
      }

      await reloadDocumentQueries();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function makeCurrent(versionId: string) {
    setSubmittingAction(`current:${versionId}`);
    setError(null);

    try {
      await apiClient.makeDocumentVersionCurrent(documentId, versionId);
      await reloadDocumentQueries();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось переключить текущую версию.",
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function uploadNextVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAction("upload-version");
    setError(null);

    try {
      const sizeBytes = Number(versionForm.sizeBytes);
      const intent = await apiClient.createDocumentVersionUploadIntent(
        documentId,
        {
          originalFilename: versionForm.originalFilename.trim(),
          mimeType: versionForm.mimeType,
          sizeBytes,
        },
      );
      await apiClient.completeDocumentUpload(documentId, intent.versionId, {
        clientReportedSize: sizeBytes,
        clientReportedMimeType: versionForm.mimeType,
      });
      await reloadDocumentQueries();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось загрузить новую версию.",
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  if (detail.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">детали</Badge>
          <CardTitle>Загружаем документ…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!detail.data) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">не найдено</Badge>
          <CardTitle>Документ недоступен</CardTitle>
          <CardDescription>
            Проверьте доступ к рабочему пространству или корректность ID документа.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="accent">детали документа</Badge>
              <CardTitle className="mt-2">{detail.data.title}</CardTitle>
              <CardDescription>
                {detail.data.description ?? "Описание пока не заполнено."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <DocumentClassificationBadge
                classification={detail.data.classification}
              />
              <Badge variant="muted">{formatStatus(detail.data.kind)}</Badge>
              <Badge variant="muted">{formatStatus(detail.data.status)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {detail.data.tags.map((tag) => (
              <Badge key={tag} variant="muted">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Текущая версия
              </div>
              {currentVersion ? (
                <>
                  <div className="mt-3 text-base text-[color:var(--foreground)]">
                    {currentVersion.originalFilename}
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--muted)]">
                    v{currentVersion.versionNo} • {currentVersion.mimeType} •{" "}
                    {currentVersion.sizeBytes} байт
                  </div>
                </>
              ) : (
                <div className="mt-3 text-sm text-[color:var(--muted)]">
                  Текущая версия ещё не задана.
                </div>
              )}
            </div>

            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Действия с документом
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.data.availableActions.canRequestSignedUrl &&
                currentVersion ? (
                  <Button asChild variant="ghost">
                    <Link href={`/documents/${documentId}`}>
                      Открыть отдельный экран
                    </Link>
                  </Button>
                ) : null}
                {detail.data.availableActions.canDelete ? (
                  <Button
                    disabled={submittingAction !== null}
                    onClick={() => void runDocumentAction("archive")}
                    variant="ghost"
                  >
                    Архивировать
                  </Button>
                ) : null}
                {detail.data.availableActions.canRestore ? (
                  <Button
                    disabled={submittingAction !== null}
                    onClick={() => void runDocumentAction("restore")}
                    variant="ghost"
                  >
                    Восстановить
                  </Button>
                ) : null}
                {sessionContext.permissions.includes("document.delete") ? (
                  <Button
                    disabled={submittingAction !== null}
                    onClick={() => void runDocumentAction("delete")}
                    variant="ghost"
                  >
                    Мягко удалить
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-6">
          <PreviewPanel
            documentId={documentId}
            enabled={detail.data.availableActions.canRequestSignedUrl}
            preferredRole={
              currentVersion?.previewStatus === "ready"
                ? "preview_pdf"
                : "original"
            }
            versionId={currentVersion?.id}
          />
          <ProcessingStatusCard
            jobs={currentVersionJobs}
            version={currentVersion}
          />
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Badge variant="accent">неизменяемые версии</Badge>
              <CardTitle>История версий</CardTitle>
              <CardDescription>
                Новая версия создаёт новую запись и новый storage path, без
                overwrite исходника.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(versions.data ?? detail.data.versions).map((version) => (
                <div
                  key={version.id}
                  className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-[color:var(--foreground)]">
                        v{version.versionNo} • {version.originalFilename}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        {version.mimeType} • {version.sizeBytes} байт
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          detail.data.currentVersion?.id === version.id
                            ? "success"
                            : "muted"
                        }
                      >
                        {detail.data.currentVersion?.id === version.id
                          ? "текущая"
                          : formatStatus(version.status)}
                      </Badge>
                      {sessionContext.permissions.includes("document.upload") &&
                      detail.data.currentVersion?.id !== version.id ? (
                        <Button
                          disabled={submittingAction !== null}
                          onClick={() => void makeCurrent(version.id)}
                          size="sm"
                          variant="ghost"
                        >
                          Сделать текущей
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {detail.data.availableActions.canUploadVersion ? (
            <Card>
              <CardHeader>
                <Badge variant="accent">загрузка новой версии</Badge>
                <CardTitle>Новая неизменяемая версия</CardTitle>
                <CardDescription>
                  Интерфейс получает intent новой версии, а затем завершает
                  контракт загрузки.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={uploadNextVersion}>
                  <Input
                    value={versionForm.originalFilename}
                    onChange={(event) =>
                      setVersionForm((current) => ({
                        ...current,
                        originalFilename: event.target.value,
                      }))
                    }
                    placeholder="next-version.pdf"
                  />
                  <div className="grid gap-3 lg:grid-cols-3">
                    <select
                      className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                      value={versionForm.mimeType}
                      onChange={(event) =>
                        setVersionForm((current) => ({
                          ...current,
                          mimeType: event.target.value,
                        }))
                      }
                    >
                      <option value="application/pdf">application/pdf</option>
                      <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                        application/vnd.openxmlformats-officedocument.wordprocessingml.document
                      </option>
                      <option value="text/plain">text/plain</option>
                    </select>
                    <Input
                      inputMode="numeric"
                      value={versionForm.sizeBytes}
                      onChange={(event) =>
                        setVersionForm((current) => ({
                          ...current,
                          sizeBytes: event.target.value,
                        }))
                      }
                      placeholder="196608"
                    />
                    <Button disabled={submittingAction !== null} type="submit">
                      {submittingAction === "upload-version"
                        ? "Загружаем…"
                        : "Создать версию"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <Badge variant="muted">связи / хранилище</Badge>
              <CardTitle>Связанные сущности</CardTitle>
              <CardDescription>
                Шаблоны, результаты запусков и производные объекты описываются
                как продуктовые связи, а не как скрытые ключи бакетов.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3">
                {(detail.data.relations ?? []).map((relation) => (
                  <div
                    key={relation.id}
                    className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
                  >
                    <div className="text-sm text-[color:var(--foreground)]">
                      {formatStatus(relation.relationType)}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {relation.targetEntityType} • {relation.targetEntityId}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3">
                {(detail.data.storageObjects ?? []).map((object) => (
                  <div
                    key={object.id}
                    className="rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{formatStatus(object.role)}</Badge>
                      <Badge variant="muted">{formatStatus(object.status)}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-[color:var(--muted)]">
                      {object.mimeType} • {object.sizeBytes ?? 0} байт
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
