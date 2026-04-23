"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { useInstalledAutomations } from "@/hooks/use-stage0-data";
import { formatDateTime, formatStatus } from "@/lib/i18n";

export function InstalledAutomationList() {
  const { data = [], isLoading } = useInstalledAutomations();

  if (isLoading) {
    return (
      <QueryState
        title="Загрузка установленных автоматизаций"
        description="Получаем копии рабочего пространства, состояние runtime-синхронизации и контуры для конструктора/запуска."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((automation) => (
        <Card key={automation.id}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{automation.version}</Badge>
                <Badge variant={badgeVariantForStatus(automation.workflowState)}>
                  {formatStatus(automation.workflowState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.builderState)}>
                  конструктор {formatStatus(automation.builderState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.syncState)}>
                  синхронизация {formatStatus(automation.syncState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.compatibilityStatus)}>
                  {formatStatus(automation.compatibilityStatus)}
                </Badge>
                <Badge variant={automation.canRun ? "success" : "muted"}>
                  {automation.canRun ? "готово к запуску" : "закрыто контуром"}
                </Badge>
              </div>
              <div>
                <CardTitle>{automation.title}</CardTitle>
                <CardDescription>{formatStatus(automation.nextGate)}</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="ghost">
                <Link href={`/automations/${automation.id}`}>Открыть детали</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/automations/${automation.id}/builder`}>Конструктор</Link>
              </Button>
              <Button asChild>
                <Link href={`/automations/${automation.id}/updates`}>Обновления источника</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Обязательные входные данные
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {automation.requiredInputs.map((input) => (
                  <Badge key={input} variant="muted">
                    {input}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Отсутствующие подключения
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {automation.missingConnections.length > 0 ? (
                  automation.missingConnections.map((connection) => (
                    <Badge key={connection} variant="danger">
                      {connection}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="success">нет</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Runtime-привязка
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted-strong)]">
                <div>проект: {automation.runtimeProjectId ?? "не создан"}</div>
                <div>процесс: {automation.runtimeFlowId ?? "ещё не синхронизирован"}</div>
                <div>синхронизировано: {automation.lastSyncedAt ? formatDateTime(automation.lastSyncedAt) : "никогда"}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Сводка требований
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="success">
                  готово {automation.requirementsSummary.ready}
                </Badge>
                <Badge variant="muted">
                  отсутствует {automation.requirementsSummary.missing}
                </Badge>
                <Badge variant="danger">
                  заблокировано {automation.requirementsSummary.blocked}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
