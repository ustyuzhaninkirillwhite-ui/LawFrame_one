"use client";

import Link from "next/link";
import { useLegalSource } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatRole, formatStatus, t } from "@/lib/i18n";

export function LegalSourceDetailView({ sourceId }: { readonly sourceId: string }) {
  const source = useLegalSource(sourceId);

  if (source.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">детали источника</Badge>
          <CardTitle>Загружаем источник...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!source.data) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">не найдено</Badge>
          <CardTitle>Источник недоступен</CardTitle>
          <CardDescription>
            Выбранный юридический источник не удалось загрузить в текущем
            рабочем пространстве.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const detail = source.data;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="accent">юридический источник</Badge>
              <CardTitle className="mt-2">{detail.title}</CardTitle>
              <CardDescription>
                {detail.caseNumber ?? "Номер дела не указан"}{" "}
                {detail.court ? `| ${detail.court}` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">{formatStatus(detail.sourceType)}</Badge>
              <Badge variant="muted">{formatStatus(detail.classification)}</Badge>
              <Badge variant={detail.status === "indexed" ? "success" : "accent"}>
                {formatStatus(detail.status)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Провайдер" value={detail.provider.name} />
            <Metric label="Видимость" value={formatStatus(detail.visibility)} />
            <Metric
              label="Состояние индекса"
              value={detail.hasEmbeddings ? "векторы готовы" : "только текст"}
            />
            <Metric label="Дата решения" value={formatDateTime(detail.decisionDate)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ghost">
              <Link href="/sources">Назад к реестру</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/research?sourceId=${detail.id}`}>Использовать в исследовании</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <Badge variant="accent">версии и задачи</Badge>
            <CardTitle>Лента индексации</CardTitle>
            <CardDescription>
              MVP показывает состояния импорта, извлечения и семантической
              индексации в одной записи источника.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {detail.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      v{version.versionNo} | {version.mimeType ?? "неизвестно"}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      размер файла: {version.fileSize ?? 0} байт | хэш текста:{" "}
                      {version.textHash ?? "не указан"}
                    </div>
                  </div>
                  <Badge variant={version.status === "indexed" ? "success" : "accent"}>
                    {formatStatus(version.status)}
                  </Badge>
                </div>
              </div>
            ))}

            {detail.importJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Задача импорта {job.id}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      процесс: {job.temporalWorkflowId ?? "н/д"}
                    </div>
                  </div>
                  <Badge variant={job.status === "completed" ? "success" : "accent"}>
                    {formatStatus(job.status)}
                  </Badge>
                </div>
                {job.errorSummary ? (
                  <div className="mt-2 text-sm text-[color:var(--muted)]">
                    {job.errorSummary}
                  </div>
                ) : null}
              </div>
            ))}

            {detail.extractionJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{job.extractor}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      попытка {job.attempt} | хэш текста: {job.textHash ?? "не указан"}
                    </div>
                  </div>
                  <Badge
                    variant={job.status === "completed" ? "success" : "accent"}
                  >
                    {formatStatus(job.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="accent">семантический слой</Badge>
            <CardTitle>Фрагменты и контур доступа</CardTitle>
            <CardDescription>
              Поиск и RAG используют юридические фрагменты, а не сырой текст
              документа. Каждый фрагмент хранит контур безопасности и стабильную
              метку источника.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {detail.chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{formatStatus(chunk.chunkType)}</Badge>
                  <Badge variant="muted">{formatStatus(chunk.securityScope)}</Badge>
                  <Badge
                    variant={chunk.embeddingHash ? "success" : "accent"}
                  >
                    {chunk.embeddingHash ? "векторизовано" : "только текст"}
                  </Badge>
                </div>
                <div className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                  {chunk.text}
                </div>
              </div>
            ))}

            <div className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-4">
              <div className="text-sm font-medium">Записи доступа</div>
              <div className="mt-3 grid gap-2">
                {detail.accessEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--muted)]"
                  >
                    <span>
                      {formatStatus(entry.accessLevel)} | роль {formatRole(entry.roleRequired ?? "custom")}
                    </span>
                    <span>{entry.expiresAt ? formatDateTime(entry.expiresAt) : "без срока действия"}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-3 text-sm text-[color:var(--foreground)]">{value}</div>
    </div>
  );
}
