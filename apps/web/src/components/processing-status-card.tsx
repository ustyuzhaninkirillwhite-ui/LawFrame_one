"use client";

import type {
  DocumentProcessingJob,
  DocumentScanStatus,
  DocumentVersionSummary,
} from "@lexframe/contracts";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatStatus } from "@/lib/i18n";

function resolveVariant(
  value:
    | DocumentScanStatus
    | DocumentVersionSummary["previewStatus"]
    | DocumentVersionSummary["extractionStatus"]
    | DocumentProcessingJob["status"],
): BadgeProps["variant"] {
  if (value === "clean" || value === "ready" || value === "completed") {
    return "success";
  }

  if (value === "infected" || value === "failed") {
    return "danger";
  }

  if (
    value === "queued" ||
    value === "running" ||
    value === "manual_review_required"
  ) {
    return "accent";
  }

  return "muted";
}

interface ProcessingStatusCardProps {
  readonly version: DocumentVersionSummary | null | undefined;
  readonly jobs?: readonly DocumentProcessingJob[];
}

export function ProcessingStatusCard({
  version,
  jobs = [],
}: ProcessingStatusCardProps) {
  if (!version) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="muted">обработка</Badge>
          <CardTitle>Состояние обработки недоступно</CardTitle>
          <CardDescription>
            У документа пока нет активной версии.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">обработка</Badge>
        <CardTitle>Состояние конвейера</CardTitle>
        <CardDescription>
          Этап 2 хранит проверку, предпросмотр и извлечение отдельно от
          UI-состояния.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Проверка
            </div>
            <Badge
              className="mt-3"
              variant={resolveVariant(version.scanStatus)}
            >
              {formatStatus(version.scanStatus)}
            </Badge>
          </div>
          <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Предпросмотр
            </div>
            <Badge
              className="mt-3"
              variant={resolveVariant(version.previewStatus)}
            >
              {formatStatus(version.previewStatus)}
            </Badge>
          </div>
          <div className="rounded-[18px] border border-[color:var(--line)] bg-white/4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Извлечение
            </div>
            <Badge
              className="mt-3"
              variant={resolveVariant(version.extractionStatus)}
            >
              {formatStatus(version.extractionStatus)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3">
          {jobs.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
              Очередь задач пока пуста.
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/3 px-4 py-3"
              >
                <div>
                  <div className="text-sm text-[color:var(--foreground)]">
                    {job.jobType}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    попытки {job.attempts}/{job.maxAttempts}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {job.lastError ? (
                    <div className="max-w-[18rem] text-right text-xs text-[color:var(--danger)]">
                      {job.lastError}
                    </div>
                  ) : null}
                  <Badge variant={resolveVariant(job.status)}>
                    {formatStatus(job.status)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
