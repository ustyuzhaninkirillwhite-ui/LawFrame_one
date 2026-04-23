"use client";

import Link from "next/link";
import * as React from "react";
import {
  useCreateLegalImportJob,
  useLegalImportJob,
  useLegalSources,
} from "@/hooks/use-stage0-data";
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
import { Textarea } from "@/components/ui/textarea";
import { formatStatus, t } from "@/lib/i18n";

export function LegalSourcesWorkspace() {
  const sources = useLegalSources();
  const createImportJob = useCreateLegalImportJob();
  const latestJob = useLegalImportJob(createImportJob.data?.id ?? null);
  const [form, setForm] = React.useState({
    documentId: "",
    title: "",
    caseNumber: "",
    notes: "",
    classification: "confidential",
    documentType: "court_decision",
  });

  const items = sources.data ?? [];
  const indexedCount = items.filter((item) => item.status === "indexed").length;
  const pendingCount = items.filter((item) => item.status !== "indexed").length;
  const privateCount = items.filter((item) => item.visibility !== "public").length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await createImportJob.mutateAsync({
      providerCode: "user_upload",
      inputType: "document",
      documentType: form.documentType as
        | "court_decision"
        | "statute"
        | "regulation"
        | "contract_template"
        | "user_document"
        | "internal_memo"
        | "analysis_result",
      classification: form.classification as
        | "public"
        | "internal"
        | "confidential"
        | "legal_secret"
        | "personal_data"
        | "client_material",
      documentId: form.documentId.trim(),
      metadata: {
        title: form.title.trim() || undefined,
        caseNumber: form.caseNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Проиндексированные источники" value={indexedCount} />
        <MetricCard label="Требуют внимания" value={pendingCount} />
        <MetricCard label="Защищённый контур" value={privateCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <Badge variant="accent">мастер импорта</Badge>
            <CardTitle>Зарегистрировать юридический источник из существующего документа</CardTitle>
            <CardDescription>
              MVP этапа 6 переиспользует библиотеку документов этапа 2. Импорт
              связывает каноническую версию документа с юридическим источником,
              затем запускает извлечение, фрагментацию и индексацию внутри LexFrame.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <Input
                placeholder="ID документа из раздела /documents"
                value={form.documentId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    documentId: event.target.value,
                  }))
                }
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Название источника"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Номер дела"
                  value={form.caseNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      caseNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                  value={form.documentType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documentType: event.target.value,
                    }))
                  }
                >
                  <option value="court_decision">судебное решение</option>
                  <option value="statute">закон</option>
                  <option value="regulation">нормативный акт</option>
                  <option value="user_document">документ пользователя</option>
                  <option value="internal_memo">внутренняя записка</option>
                </select>
                <select
                  className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
                  value={form.classification}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      classification: event.target.value,
                    }))
                  }
                >
                  <option value="public">публично</option>
                  <option value="internal">внутренний контур</option>
                  <option value="confidential">конфиденциально</option>
                  <option value="legal_secret">адвокатская тайна</option>
                  <option value="personal_data">персональные данные</option>
                  <option value="client_material">материалы клиента</option>
                </select>
              </div>
              <Textarea
                placeholder="Метаданные или заметки оператора"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    createImportJob.isPending || form.documentId.trim().length === 0
                  }
                  type="submit"
                >
                  {createImportJob.isPending ? "Импортируем..." : "Создать задачу импорта"}
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/documents">Открыть библиотеку документов</Link>
                </Button>
              </div>
            </form>

            {createImportJob.error instanceof Error ? (
              <div className="mt-4 rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
                {createImportJob.error.message}
              </div>
            ) : null}

            {latestJob.data ? (
              <div className="mt-6 rounded-[22px] border border-[color:var(--line)] bg-white/4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Последняя задача импорта
                    </div>
                    <div className="mt-2 text-base">{latestJob.data.id}</div>
                  </div>
                  <Badge
                    variant={
                      latestJob.data.status === "completed" ? "success" : "accent"
                    }
                  >
                    {formatStatus(latestJob.data.status)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                  <div>
                    Процесс: {latestJob.data.temporalWorkflowId ?? "не привязан"}
                  </div>
                  <div>
                    Обработано {latestJob.data.processedItems} из{" "}
                    {latestJob.data.totalItems}
                  </div>
                  <div>
                    Ошибок: {latestJob.data.failedItems}
                    {latestJob.data.errorSummary
                      ? ` - ${latestJob.data.errorSummary}`
                      : ""}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="accent">реестр источников</Badge>
            <CardTitle>Юридические источники рабочего пространства</CardTitle>
            <CardDescription>
              Источники отделены от бинарного файлового хранилища. Поиск и RAG
              работают на юридическом семантическом слое, но каждая запись может
              ссылаться на исходный документ и версию.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sources.isLoading ? (
              <EmptyBox label="Загружаем юридические источники..." />
            ) : items.length === 0 ? (
              <EmptyBox label="Юридические источники пока не зарегистрированы." />
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-medium">{item.title}</div>
                      <div className="mt-2 text-sm text-[color:var(--muted)]">
                        {item.caseNumber ?? "Номер дела не указан"}{" "}
                        {item.court ? `| ${item.court}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="muted">{formatStatus(item.sourceType)}</Badge>
                      <Badge variant="muted">{formatStatus(item.classification)}</Badge>
                      <Badge
                        variant={item.status === "indexed" ? "success" : "accent"}
                      >
                        {formatStatus(item.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
                    <div>
                      Провайдер: {item.provider.name} | Видимость: {formatStatus(item.visibility)}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>
                        {item.hasEmbeddings ? "Векторы готовы" : "Векторов нет"}
                      </span>
                      <Link
                        className="text-[color:var(--accent-strong)] underline"
                        href={`/sources/${item.id}`}
                      >
                        Открыть детали
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-white/4 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-3 font-[family-name:var(--font-display)] text-4xl">
        {value}
      </div>
    </div>
  );
}

function EmptyBox({ label }: { readonly label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
      {t(label)}
    </div>
  );
}
