"use client";

import type { ApprovalTaskSummary } from "@lexframe/contracts";
import Link from "next/link";
import {
  useApprovalTasks,
  useApproveApprovalTask,
  useRejectApprovalTask,
  useRequestApprovalTaskChanges,
} from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { badgeVariantForStatus } from "@/components/stage3-shared";
import { formatDateTime, formatRole, formatStatus } from "@/lib/i18n";

export function ApprovalInboxPanel() {
  const tasks = useApprovalTasks();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">входящие согласований</Badge>
          <CardTitle>Согласования запусков и отправки</CardTitle>
          <CardDescription>
            Этап 8 хранит задачи согласования явно и связывает их с запусками
            процессов или запросами на отправку.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(tasks.data ?? []).length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
              Нет активных задач согласования.
            </div>
          ) : (
            (tasks.data ?? []).map((task) => <ApprovalTaskCard key={task.id} task={task} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalTaskCard({
  task,
}: {
  readonly task: ApprovalTaskSummary;
}) {
  const approve = useApproveApprovalTask(task?.id);
  const reject = useRejectApprovalTask(task?.id);
  const requestChanges = useRequestApprovalTaskChanges(task?.id);

  return (
    <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(task.status)}>{formatStatus(task.status)}</Badge>
            {task.workflowRunId ? (
              <Badge variant="muted">контур запуска</Badge>
            ) : null}
            {task.approverRole ? <Badge variant="muted">{formatRole(task.approverRole)}</Badge> : null}
          </div>
          <div className="text-sm font-medium">{task.title}</div>
          <div className="text-xs text-[color:var(--muted)]">
            срок {task.dueAt ? formatDateTime(task.dueAt) : "не указан"} • создано {formatDateTime(task.createdAt)}
          </div>
          {task.workflowRunId ? (
            <Link className="text-xs text-[color:var(--accent-strong)] underline" href={`/runs/${task.workflowRunId}`}>
              Открыть запуск
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void approve.mutateAsync({ comment: "Согласовано из входящих" })}
            disabled={approve.isPending || task.status !== "pending"}
          >
            Согласовать
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void requestChanges.mutateAsync({ comment: "Нужны правки" })}
            disabled={requestChanges.isPending || task.status !== "pending"}
          >
            Запросить правки
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reject.mutateAsync({ comment: "Отклонено из входящих" })}
            disabled={reject.isPending || task.status !== "pending"}
          >
            Отклонить
          </Button>
        </div>
      </div>
    </div>
  );
}
