"use client";

import type {
  DocumentObjectRole,
  SignedUrlResponse,
} from "@lexframe/contracts";
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
import { formatDateTime, formatStatus } from "@/lib/i18n";

interface PreviewPanelProps {
  readonly documentId: string;
  readonly versionId?: string | null;
  readonly preferredRole?: DocumentObjectRole;
  readonly enabled?: boolean;
}

interface PreviewState {
  readonly requestKey: string;
  readonly signedUrl: SignedUrlResponse | null;
  readonly error: string | null;
}

export function PreviewPanel({
  documentId,
  versionId,
  preferredRole = "preview_pdf",
  enabled = true,
}: PreviewPanelProps) {
  const { apiClient } = useSessionBridge();
  const requestKey = `${documentId}:${versionId ?? "none"}:${preferredRole}`;
  const [previewState, setPreviewState] = React.useState<PreviewState>({
    requestKey,
    signedUrl: null,
    error: null,
  });
  const [loading, setLoading] = React.useState(false);
  const signedUrl =
    previewState.requestKey === requestKey ? previewState.signedUrl : null;
  const error =
    previewState.requestKey === requestKey ? previewState.error : null;

  async function requestSignedUrl() {
    if (!versionId || !enabled) {
      return;
    }

    setLoading(true);
    setPreviewState({
      requestKey,
      signedUrl: null,
      error: null,
    });

    try {
      const nextSignedUrl = await apiClient.createDocumentSignedUrl(
        documentId,
        {
          versionId,
          objectRole: preferredRole,
          purpose: preferredRole === "original" ? "download" : "preview",
        },
      );
      setPreviewState({
        requestKey,
        signedUrl: nextSignedUrl,
        error: null,
      });
    } catch (requestError) {
      setPreviewState({
        requestKey,
        signedUrl: null,
        error:
          requestError instanceof Error
            ? requestError.message
            : "Не удалось получить подписанную ссылку.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">подписанная ссылка</Badge>
        <CardTitle>Контур предпросмотра и скачивания</CardTitle>
        <CardDescription>
          URL выдаётся backend-ом только на короткое время и обновляется без
          перезагрузки страницы.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Цель
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="muted">{formatStatus(preferredRole)}</Badge>
            {versionId ? (
              <Badge variant="muted">версия {versionId.slice(0, 8)}</Badge>
            ) : (
              <Badge variant="danger">версия отсутствует</Badge>
            )}
          </div>
        </div>

        {signedUrl ? (
          <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-[color:var(--foreground)]">
                  Ссылка готова
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  действует до {formatDateTime(signedUrl.expiresAt)}
                </div>
              </div>
              <Badge variant="success">активна</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <a href={signedUrl.signedUrl} rel="noreferrer" target="_blank">
                  Открыть ссылку
                </a>
              </Button>
              <Button onClick={() => void requestSignedUrl()} variant="ghost">
                Обновить ссылку
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Ссылка предпросмотра пока не запрошена.
          </div>
        )}

        {error ? (
          <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        ) : null}

        <Button
          className="w-full"
          disabled={!enabled || !versionId || loading}
          onClick={() => void requestSignedUrl()}
        >
          {loading ? "Запрашиваем…" : "Запросить подписанную ссылку"}
        </Button>
      </CardContent>
    </Card>
  );
}
