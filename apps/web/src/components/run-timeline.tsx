"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { badgeVariantForStatus } from "@/components/stage3-shared";
import { useRuns } from "@/hooks/use-stage0-data";

export function RunTimeline({ automationId }: { readonly automationId?: string }) {
  const runs = useRuns();
  const items = (runs.data ?? []).filter((run) =>
    automationId ? run.automationId === automationId : true,
  );

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">runtime</Badge>
        <CardTitle>История запусков</CardTitle>
        <CardDescription>
          Backend управляет статусом выполнения, шагами approval и артефактами, а UI
          только рендерит текущее состояние.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted-strong)]">
            Для этой автоматизации ещё нет запусков.
          </div>
        ) : null}

        {items.map((run) => (
          <div
            key={run.id}
            className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">{run.title}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={badgeVariantForStatus(run.status)}>{run.status}</Badge>
                  <Badge variant={badgeVariantForStatus(run.approvalState)}>
                    approval {run.approvalState}
                  </Badge>
                  {run.externalRunId ? (
                    <Badge variant="muted">{run.externalRunId}</Badge>
                  ) : null}
                </div>
                <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  {run.traceId}
                </div>
                <Link
                  className="text-xs text-[color:var(--accent-strong)] underline"
                  href={`/runs/${run.id}`}
                >
                  Open run page
                </Link>
              </div>
              <div className="text-right text-xs text-[color:var(--muted)]">
                <div>текущий шаг: {run.currentStep}</div>
                <div>артефакты: {run.artifactRefs.length}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                <span>{run.currentStep}</span>
                <span>{run.progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/6">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)]"
                  style={{ width: `${run.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {run.stepStatus.map((step) => (
                <div
                  key={`${run.id}:${step.stepCode}`}
                  className="rounded-[18px] border border-[color:var(--line)] bg-white/3 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{step.stepCode}</Badge>
                    <Badge variant={badgeVariantForStatus(step.status)}>
                      {step.status}
                    </Badge>
                    {step.requiresApproval ? (
                      <Badge variant="accent">approval</Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--muted-strong)]">
                    {step.moduleCode}
                  </div>
                  {step.errorCode ? (
                    <div className="mt-2 text-xs text-[color:var(--danger)]">
                      error: {step.errorCode}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--muted)]">
              <span>started: {run.startedAt ?? "—"}</span>
              <span>finished: {run.finishedAt ?? "—"}</span>
              <span>error: {run.errorCode ?? "none"}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
