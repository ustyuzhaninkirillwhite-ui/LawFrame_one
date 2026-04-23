"use client";

import Link from "next/link";
import { useDashboardSnapshot } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { formatDateTime, formatRole, formatStatus } from "@/lib/i18n";

export function DashboardOverview() {
  const dashboard = useDashboardSnapshot();

  if (dashboard.isLoading || !dashboard.data) {
    return (
      <QueryState
        title="Загрузка обзорного снимка"
        description="Обзор собирает запуски, согласования, рекомендации и уведомления через backend-агрегацию."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Активные запуски" value={dashboard.data.activeRuns.length} tone="исполнение" />
        <SummaryCard label="Ожидают согласования" value={dashboard.data.pendingApprovals.length} tone="контуры" />
        <SummaryCard label="Непрочитанные уведомления" value={dashboard.data.unreadNotificationsCount} tone="входящие" />
        <SummaryCard label="Состояние системы" value={formatStatus(dashboard.data.systemStatus.overall)} tone="эксплуатация" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge variant="accent">запуски</Badge>
            <CardTitle>Активные запуски</CardTitle>
            <CardDescription>Оперативная панель активных запусков автоматизаций.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.data.activeRuns.length === 0 ? (
              <EmptyState text="Сейчас нет активных запусков." />
            ) : (
              dashboard.data.activeRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForStatus(run.status)}>{formatStatus(run.status)}</Badge>
                    <Badge variant="muted">{run.currentStep}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-medium">{run.title}</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    ход {run.progressPercent}% | согласования {formatStatus(run.approvalState)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="accent">согласования</Badge>
            <CardTitle>Ожидающие согласования</CardTitle>
            <CardDescription>Ручные контуры, которые сейчас блокируют отправку или документный поток.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.data.pendingApprovals.length === 0 ? (
              <EmptyState text="Нет ожидающих согласований." />
            ) : (
              dashboard.data.pendingApprovals.map((task) => (
                <Link
                  key={task.id}
                  href="/approvals"
                  className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForStatus(task.status)}>{formatStatus(task.status)}</Badge>
                    <Badge variant="muted">{task.approverRole ? formatRole(task.approverRole) : task.approverUserId ?? "не назначено"}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-medium">{task.title}</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    создано {formatDateTime(task.createdAt)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <Badge variant="muted">результаты</Badge>
            <CardTitle>Последние результаты</CardTitle>
            <CardDescription>Последние сохранённые выходные данные, доступные в документном контуре.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.data.recentArtifacts.length === 0 ? (
              <EmptyState text="Результаты появятся после сохранения выходных данных запуска." />
            ) : (
              dashboard.data.recentArtifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/documents/${artifact.documentId}`}
                  className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{formatStatus(artifact.artifactType)}</Badge>
                    <Badge variant="muted">{formatStatus(artifact.source)}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-medium">{artifact.title}</div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <Badge variant="muted">рекомендации</Badge>
            <CardTitle>Рекомендации</CardTitle>
            <CardDescription>Рекомендательные предложения, попавшие в обзорный снимок.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.data.recommendations.length === 0 ? (
              <EmptyState text="Сейчас нет новых рекомендаций." />
            ) : (
              dashboard.data.recommendations.map((recommendation) => (
                <Link
                  key={recommendation.id}
                  href="/recommendations"
                  className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForStatus(recommendation.riskLevel)}>
                      {formatStatus(recommendation.riskLevel)}
                    </Badge>
                    <Badge variant="muted">{formatStatus(recommendation.scope)}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-medium">{recommendation.title}</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    {recommendation.summary}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <Badge variant="muted">эксплуатация</Badge>
            <CardTitle>Состояние системы</CardTitle>
            <CardDescription>Краткая операционная сводка на основе данных готовности.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariantForStatus(dashboard.data.systemStatus.overall)}>
                  {formatStatus(dashboard.data.systemStatus.overall)}
                </Badge>
                <Badge variant="muted">{dashboard.data.systemStatus.incidentsOpen} инцидентов</Badge>
              </div>
              <div className="mt-3 text-sm text-[color:var(--muted-strong)]">
                {dashboard.data.systemStatus.summary}
              </div>
            </div>
            {dashboard.data.systemStatus.components.map((component) => (
              <div
                key={component.code}
                className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForStatus(component.status)}>{formatStatus(component.status)}</Badge>
                  <Badge variant="muted">{component.code}</Badge>
                </div>
                <div className="mt-3 text-sm text-[color:var(--muted-strong)]">
                  {component.summary}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge variant="danger">запуски</Badge>
          <CardTitle>Неуспешные запуски</CardTitle>
          <CardDescription>Операционная зона для разбора неуспешных выполнений.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {dashboard.data.failedRuns.length === 0 ? (
            <EmptyState text="В текущем обзоре нет неуспешных запусков." />
          ) : (
            dashboard.data.failedRuns.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="danger">{formatStatus(run.status)}</Badge>
                  {run.errorCode ? <Badge variant="muted">{run.errorCode}</Badge> : null}
                </div>
                <div className="mt-3 text-sm font-medium">{run.title}</div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly tone: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="muted">{tone}</Badge>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-[family-name:var(--font-display)]">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
      {text}
    </div>
  );
}
