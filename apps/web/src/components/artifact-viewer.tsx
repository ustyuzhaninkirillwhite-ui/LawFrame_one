"use client";

import Link from "next/link";
import { useRunArtifacts } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatStatus } from "@/lib/i18n";

interface ArtifactViewerProps {
  readonly runId?: string | null;
}

export function ArtifactViewer({ runId }: ArtifactViewerProps) {
  const artifacts = useRunArtifacts(runId);

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">результаты запуска</Badge>
        <CardTitle>Выходные данные процесса остаются в документном домене</CardTitle>
        <CardDescription>
          Activepieces и backend-обработчики сохраняют результат как управляемый
          документ с точной версией.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!runId ? (
          <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Нет активного запуска для просмотра результатов.
          </div>
        ) : artifacts.isLoading ? (
          <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Загружаю результаты запуска…
          </div>
        ) : (artifacts.data ?? []).length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Для этого запуска пока нет результатов.
          </div>
        ) : (
          (artifacts.data ?? []).map((artifact) => (
            <div
              key={artifact.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
            >
              <div>
                <div className="text-sm text-[color:var(--foreground)]">
                  {artifact.title}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {formatStatus(artifact.artifactType)} • {artifact.mimeType}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="muted">{formatStatus(artifact.source)}</Badge>
                <Link
                  className="text-sm text-[color:var(--accent-strong)] underline"
                  href={`/documents/${artifact.documentId}`}
                >
                  Открыть документ
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
