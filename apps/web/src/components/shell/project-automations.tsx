"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { useStage15ProjectAutomations } from "@/hooks/domain/stage15";
import { formatDateTime, formatStatus } from "@/lib/i18n";

export function ProjectAutomations({ projectId }: { readonly projectId: string }) {
  const automations = useStage15ProjectAutomations(projectId);

  if (automations.isLoading) {
    return (
      <QueryState
        title="Загрузка автоматизаций"
        description="Получаем project-aware список установленных автоматизаций."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {(automations.data ?? []).map((automation) => (
        <Card key={automation.id}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{automation.version}</Badge>
                <Badge variant={badgeVariantForStatus(automation.workflowState)}>
                  {formatStatus(automation.workflowState)}
                </Badge>
                <Badge variant={badgeVariantForStatus(automation.syncState)}>
                  {formatStatus(automation.syncState)}
                </Badge>
                <Badge variant={automation.canRun ? "success" : "muted"}>
                  {automation.canRun ? "готово к запуску" : "нужна проверка"}
                </Badge>
              </div>
              <CardTitle className="mt-3">{automation.title}</CardTitle>
              <CardDescription>{formatStatus(automation.nextGate)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="ghost">
                <Link href={`/app/projects/${projectId}/automations/${automation.id}`}>
                  Детали
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/app/projects/${projectId}/automations/${automation.id}/automation`}>
                  Автоматизация
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <RuntimeBlock label="Runtime project" value={automation.runtimeProjectId ?? "не создан"} />
            <RuntimeBlock label="Runtime flow" value={automation.runtimeFlowId ?? "не синхронизирован"} />
            <RuntimeBlock
              label="Последняя синхронизация"
              value={automation.lastSyncedAt ? formatDateTime(automation.lastSyncedAt) : "никогда"}
            />
            <div className="lg:col-span-3 rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RuntimeBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-2 break-all text-sm text-[color:var(--muted-strong)]">
        {value}
      </div>
    </div>
  );
}
