"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, RequirementPanel, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import { RunTimeline } from "@/components/run-timeline";
import {
  useAutomationDetail,
  useAutomationRuntimeRequirements,
  useCreateAutomationRun,
  useForkInstalledAutomationToTemplate,
  useRunPreflight,
  useRuntimeConnections,
  useSyncAutomationRuntime,
  useUpsertRuntimeConnection,
} from "@/hooks/use-stage0-data";
import { useSessionBridge } from "@/providers/session-provider";
import { formatDateTime, formatStatus, t } from "@/lib/i18n";

export function AutomationDetailPanel() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const automationId = readParam(params.id) ?? "aut_01hzyd8md4j4yhr40t1k0f8p9n";
  const { sessionContext } = useSessionBridge();
  const automation = useAutomationDetail(automationId);
  const runtime = useAutomationRuntimeRequirements(automationId);
  const runtimeConnections = useRuntimeConnections();
  const syncMutation = useSyncAutomationRuntime(automationId);
  const preflightMutation = useRunPreflight(automationId);
  const createRunMutation = useCreateAutomationRun(automationId);
  const connectMutation = useUpsertRuntimeConnection();
  const forkMutation = useForkInstalledAutomationToTemplate(automationId);
  const canManageConnections = sessionContext.permissions.includes("connections.manage");

  if (automation.isLoading || runtime.isLoading || !automation.data || !runtime.data) {
    return (
      <QueryState
        title="Загрузка runtime-автоматизации"
        description="Получаем закреплённый процесс, runtime-привязку, требования и список подключений."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{automation.data.version}</Badge>
                <Badge variant={badgeVariantForStatus(automation.data.workflowState)}>
                  {formatStatus(automation.data.workflowState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.data.builderState)}>
                  конструктор {formatStatus(automation.data.builderState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.data.syncState)}>
                  синхронизация {formatStatus(automation.data.syncState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.data.compatibilityStatus)}>
                  {formatStatus(automation.data.compatibilityStatus)}
                </Badge>
                <Badge variant={automation.data.canRun ? "success" : "muted"}>
                  {automation.data.canRun ? "готово к запуску" : "закрыто контуром"}
                </Badge>
              </div>
              <CardTitle>{automation.data.title}</CardTitle>
              <CardDescription>
                Backend LexFrame остаётся источником истины для автоматизации,
                запуска, согласования и результата. Activepieces хранит только
                runtime-проекцию и состояние конструктора.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <RuntimeInfoBlock
                  label="Runtime-проект"
                  value={automation.data.runtimeProjectId ?? "не создан"}
                />
                <RuntimeInfoBlock
                  label="Runtime-процесс"
                  value={automation.data.runtimeFlowId ?? "не синхронизирован"}
                />
                <RuntimeInfoBlock
                  label="Хэш синхронизации"
                  value={automation.data.syncHash ?? "ожидает синхронизации"}
                />
                <RuntimeInfoBlock
                  label="Последняя синхронизация"
                  value={automation.data.lastSyncedAt ? formatDateTime(automation.data.lastSyncedAt) : "ещё не синхронизировано"}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SummaryBlock
                  label="Требования"
                  value={`${automation.data.requirementsSummary.ready} готово / ${automation.data.requirementsSummary.missing} отсутствует / ${automation.data.requirementsSummary.blocked} заблокировано`}
                />
                <SummaryBlock
                  label="Следующий контур"
                  value={formatStatus(automation.data.nextGate)}
                />
              </div>

              <div className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Обязательные входные данные
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {automation.data.requiredInputs.map((input) => (
                    <Badge key={input} variant="muted">
                      {input}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    void syncMutation.mutateAsync({ dryRun: false });
                  }}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? "Синхронизируем..." : "Синхронизировать runtime"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void preflightMutation.mutateAsync({});
                  }}
                  disabled={preflightMutation.isPending}
                >
                  {preflightMutation.isPending ? "Проверяем..." : "Запустить предпроверку"}
                </Button>
                <Button
                  onClick={() => {
                    void createRunMutation.mutateAsync({}).then((response) => {
                      router.push(response.runUrl);
                    });
                  }}
                  disabled={
                    createRunMutation.isPending ||
                    !runtime.data.canRun ||
                    !preflightMutation.data?.canStart
                  }
                >
                  {createRunMutation.isPending ? "Запускаем..." : "Запустить"}
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/automations/${automationId}/builder`}>Открыть конструктор</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/automations/${automationId}/updates`}>Обновления источника</Link>
                </Button>
                <Button
                  onClick={() => {
                    void forkMutation.mutateAsync({
                      title: `${automation.data.title} черновик`,
                      targetScope: "workspace",
                    });
                  }}
                  disabled={forkMutation.isPending}
                >
                  Сохранить как шаблон
                </Button>
              </div>

              {syncMutation.data ? (
                <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Runtime синхронизирован: {syncMutation.data.runtimeProjectId} /{" "}
                  {syncMutation.data.runtimeFlowId}
                </div>
              ) : null}

              {preflightMutation.data ? (
                <div className="rounded-[22px] border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
                  Предпроверка {preflightMutation.data.canStart ? "готова" : "заблокирована"}:{" "}
                  {preflightMutation.data.summary}
                </div>
              ) : null}

              {createRunMutation.data ? (
                <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Запуск создан:{" "}
                  <Link className="underline" href={createRunMutation.data.runUrl}>
                    {createRunMutation.data.runId}
                  </Link>{" "}
                  ({formatStatus(createRunMutation.data.status)})
                </div>
              ) : null}
            </CardContent>
          </Card>

          <RequirementPanel requirements={automation.data.requirements} />
          <RunTimeline automationId={automationId} />
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Badge variant="muted">готовность runtime</Badge>
              <CardTitle>Подключения и компоненты</CardTitle>
              <CardDescription>
                Конструктор и цикл выполнения открываются только после
                backend-синхронизации и состояния подключений в контуре
                рабочего пространства.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Отсутствующие подключения
                </div>
                <div className="mt-3 grid gap-3">
                  {runtime.data.missingConnections.length === 0 ? (
                    <Badge variant="success">всё подключено</Badge>
                  ) : (
                    runtime.data.missingConnections.map((connection) => (
                      <div
                        key={connection.code}
                        className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {connection.displayName}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--muted)]">
                              {connection.code}
                            </div>
                          </div>
                          <Badge variant={badgeVariantForStatus(connection.status)}>
                            {formatStatus(connection.status)}
                          </Badge>
                        </div>
                        {canManageConnections ? (
                          <Button
                            className="mt-3"
                            variant="ghost"
                            onClick={() => {
                              void connectMutation.mutateAsync({
                                code: connection.code,
                                provider: connection.provider,
                                displayName: connection.displayName,
                              });
                            }}
                            disabled={connectMutation.isPending}
                          >
                            Подключить
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Доступные runtime-подключения
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(runtimeConnections.data ?? []).length > 0 ? (
                    runtimeConnections.data!.map((connection) => (
                      <Badge key={connection.id} variant={badgeVariantForStatus(connection.status)}>
                        {connection.displayName}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="muted">нет</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Обязательные компоненты
                </div>
                <div className="mt-3 grid gap-2">
                  {runtime.data.requiredPieces.map((piece) => (
                    <div
                      key={`${piece.packageName}:${piece.stepCode}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-[color:var(--line)] bg-black/20 px-3 py-2 text-sm"
                    >
                      <span>{piece.packageName}</span>
                      <Badge variant={badgeVariantForStatus(piece.status)}>
                        {piece.stepCode}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Runtime-предупреждения
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted-strong)]">
                  {runtime.data.warnings.length > 0 ? (
                    runtime.data.warnings.map((warning) => (
                      <div key={warning} className="rounded-[16px] bg-black/20 px-3 py-2">
                        {warning}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[16px] bg-black/20 px-3 py-2">
                      Список предупреждений пуст, критических runtime-блокеров нет.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="muted">закрепление источника</Badge>
              <CardTitle>Установленная запись</CardTitle>
              <CardDescription>
                Копия рабочего пространства живёт отдельно от исходного шаблона
                и синхронизируется в runtime только по явному действию.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-[color:var(--muted-strong)]">
              <RuntimeInfoBlock label="Ссылка на шаблон" value={automation.data.templateId} />
              <RuntimeInfoBlock
                label="Версия источника"
                value={automation.data.sourceTemplateVersionId}
              />
              <RuntimeInfoBlock
                label="Доступность"
                value={
                  automation.data.available
                    ? "Доступно для синхронизации."
                    : automation.data.disabledReason ?? "Отключено"
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RuntimeInfoBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-2 break-all text-sm text-[color:var(--muted-strong)]">
        {value}
      </div>
    </div>
  );
}

function SummaryBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t(label)}
      </div>
      <div className="mt-2 text-sm leading-6 text-[color:var(--muted-strong)]">
        {value}
      </div>
    </div>
  );
}
