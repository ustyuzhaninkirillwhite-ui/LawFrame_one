"use client";

import * as React from "react";
import {
  useAnalyzeLegalRag,
  useLegalRagRequest,
  useLegalSearch,
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

export function LegalResearchWorkspace({
  initialSourceId,
}: {
  readonly initialSourceId?: string | null;
}) {
  const sources = useLegalSources();
  const [query, setQuery] = React.useState("");
  const [taskType, setTaskType] = React.useState("legal_position_analysis");
  const [notes, setNotes] = React.useState("");
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>(
    initialSourceId ? [initialSourceId] : [],
  );
  const [isTransitionPending, startTransition] = React.useTransition();
  const deferredQuery = React.useDeferredValue(query);
  const searchInput =
    deferredQuery.trim().length > 0 || selectedSourceIds.length > 0
      ? {
          query: deferredQuery.trim(),
          mode: "hybrid" as const,
          selectedSourceIds,
          limit: 12,
        }
      : null;
  const search = useLegalSearch(searchInput, {
    enabled: Boolean(searchInput),
  });
  const analyzeRag = useAnalyzeLegalRag();
  const activeRequestId = analyzeRag.data?.id ?? null;
  const activeRequest = useLegalRagRequest(activeRequestId);
  const analysis = activeRequest.data ?? analyzeRag.data ?? null;

  function toggleSource(sourceId: string) {
    startTransition(() => {
      setSelectedSourceIds((current) =>
        current.includes(sourceId)
          ? current.filter((item) => item !== sourceId)
          : [...current, sourceId],
      );
    });
  }

  async function runAnalysis() {
    await analyzeRag.mutateAsync({
      taskType,
      question: notes.trim().length > 0 ? notes.trim() : deferredQuery.trim(),
      sourceSelection: {
        mode:
          selectedSourceIds.length > 0 && deferredQuery.trim().length > 0
            ? "selected_and_search"
            : selectedSourceIds.length > 0
              ? "selected_only"
              : "search_only",
        selectedSourceIds,
        searchQuery: deferredQuery.trim() || undefined,
      },
      options: {
        maxContextChunks: 6,
        requireCitations: true,
        includeUnsupportedClaims: true,
      },
    });
  }

  return (
    <div className="grid gap-6" data-testid="legal-research-workspace">
      <Card>
        <CardHeader>
          <Badge variant="accent">гибридный поиск</Badge>
          <CardTitle>Поиск практики и анализ с обязательными источниками</CardTitle>
          <CardDescription>
            Контур исследования держит поиск и RAG на backend. Интерфейс
            получает только структурированные результаты, проверенные ссылки на
            источники и состояния заблокированных маршрутов.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr_0.7fr]">
            <Input
              data-testid="legal-search-query-input"
              placeholder="Поиск по юридической практике"
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setQuery(nextValue);
                });
              }}
            />
            <Input
              placeholder="Тип задачи"
              value={taskType}
              onChange={(event) => setTaskType(event.target.value)}
            />
            <Button
              disabled={
                analyzeRag.isPending ||
                (deferredQuery.trim().length === 0 && selectedSourceIds.length === 0)
              }
              onClick={() => {
                void runAnalysis();
              }}
            >
              {analyzeRag.isPending ? "Анализируем..." : "Запустить анализ с источниками"}
            </Button>
          </div>
          <Textarea
            placeholder="Необязательный контекст или правовой вопрос"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div className="text-sm text-[color:var(--muted)]">
            Состояние запроса: {isTransitionPending ? "обновляем фильтры" : "стабильно"} |
            Поиск: {search.isFetching ? "идёт загрузка" : "готов"}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader>
            <Badge variant="accent">корзина источников</Badge>
            <CardTitle>Выбранные источники</CardTitle>
            <CardDescription>
              Корзина ограничивает сбор контекста и повышает разнообразие
              источников для итогового RAG-запроса.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(sources.data ?? []).map((source) => {
              const selected = selectedSourceIds.includes(source.id);

              return (
                <button
                  key={source.id}
                  className={`rounded-[20px] border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10"
                      : "border-[color:var(--line)] bg-white/3"
                  }`}
                  onClick={() => toggleSource(source.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{source.title}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        {source.caseNumber ?? "Номер дела не указан"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="muted">{formatStatus(source.classification)}</Badge>
                      <Badge variant={selected ? "success" : "muted"}>
                        {selected ? "выбрано" : "ожидает"}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Badge variant="accent">результаты поиска</Badge>
              <CardTitle>Результаты в выбранном контуре</CardTitle>
              <CardDescription>
                Карточки показывают компоненты гибридной оценки и стабильные
                ссылки на источники без раскрытия сырых данных поискового движка.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!searchInput ? (
                <EmptyBox label="Введите запрос или выберите хотя бы один источник." />
              ) : search.isLoading ? (
                <EmptyBox label="Ищем юридические фрагменты..." />
              ) : search.isError ? (
                <EmptyBox label="Поиск временно недоступен." />
              ) : (search.data?.results.length ?? 0) === 0 ? (
                <EmptyBox label="В текущем контуре результатов нет." />
              ) : (
                search.data?.results.map((result) => (
                  <div
                    key={result.chunk.id}
                    className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-medium">
                          {result.source.title}
                        </div>
                        <div className="mt-2 text-sm text-[color:var(--muted)]">
                          {result.snippet}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="muted">#{result.rank}</Badge>
                        <Badge variant="muted">
                          лексика {result.scoreComponents.lexical}
                        </Badge>
                        <Badge variant="muted">
                          смысл {result.scoreComponents.semantic}
                        </Badge>
                        <Badge variant="success">{result.citation.citationId}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
                      <div>
                        {result.source.caseNumber ?? "Номер дела не указан"}{" "}
                        {result.source.court ? `| ${result.source.court}` : ""}
                      </div>
                      <div>
                        страницы {result.citation.pageFrom ?? "н/д"}-
                        {result.citation.pageTo ?? "н/д"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="accent">вывод с источниками</Badge>
              <CardTitle>Юридический анализ</CardTitle>
              <CardDescription>
                Неподтверждённые утверждения отделяются от аргументов с
                источниками, а заблокированные маршруты останавливаются на
                продуктовом слое без скрытого fallback.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!analysis ? (
                <EmptyBox label="Запустите поиск или анализ, чтобы заполнить эту панель." />
              ) : analysis.status === "blocked" ? (
                <div className="rounded-[18px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 p-4 text-sm text-[color:var(--danger)]">
                  ИИ-маршрут заблокирован политикой рабочего пространства или
                  отсутствующим правом доступа.
                </div>
              ) : (
                <>
                  <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                        Сводка
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="muted">{analysis.aiRoute}</Badge>
                        <Badge
                          variant={
                            analysis.validationStatus === "valid"
                              ? "success"
                              : "accent"
                          }
                        >
                          {formatStatus(analysis.validationStatus)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                      {analysis.output?.summary ?? "Результат анализа пока отсутствует."}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <AnalysisList
                      label="Факты"
                      items={
                        analysis.output?.facts.map((fact) => ({
                          title: fact.text,
                          meta: fact.citations.join(", "),
                        })) ?? []
                      }
                    />
                    <AnalysisList
                      label="Аргументы"
                      items={
                        analysis.output?.arguments.map((argument) => ({
                          title: argument.position,
                          meta: `${argument.strength} | ${argument.citations.join(", ")}`,
                        })) ?? []
                      }
                    />
                  </div>

                  <AnalysisList
                    label="Неподтверждённые утверждения"
                    items={
                      analysis.output?.unsupportedClaims.map((claim) => ({
                        title: claim,
                        meta: "вынесено из подтверждённой аргументации",
                      })) ?? []
                    }
                  />

                  <AnalysisList
                    label="Риски"
                    items={
                      analysis.riskFlags.map((flag) => ({
                        title: flag,
                        meta: "серверная проверка",
                      })) ?? []
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AnalysisList({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly { readonly title: string; readonly meta: string }[];
}) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-3 grid gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">Нет элементов.</div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${label}-${index}-${item.title}`}
              className="rounded-[16px] border border-[color:var(--line)] bg-black/10 p-3"
            >
              <div className="text-sm text-[color:var(--foreground)]">{item.title}</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">{item.meta}</div>
            </div>
          ))
        )}
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
