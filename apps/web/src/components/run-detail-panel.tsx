"use client";

import type { ApprovalTaskDetail, DeliveryRequestSummary, RunArtifact, RunStepDetail } from "@lexframe/contracts";
import Link from "next/link";
import {
  useAcceptArtifactAsDocument,
  useApproveApprovalTask,
  useApproveDeliveryRequest,
  useCancelDeliveryRequest,
  useCancelRun,
  useCreateArtifactSignedUrl,
  useNotifications,
  useRejectApprovalTask,
  useRequestApprovalTaskChanges,
  useRetryDeliveryRequest,
  useRetryRun,
  useRetryRunStep,
  useRun,
  useSendDeliveryRequest,
} from "@/hooks/use-stage0-data";
import { useRunRealtimeSubscription } from "@/providers/realtime-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { formatDateTime, formatStatus, t } from "@/lib/i18n";

export function RunDetailPanel({ runId }: { readonly runId: string }) {
  useRunRealtimeSubscription(runId);
  const run = useRun(runId);
  const cancelRun = useCancelRun(runId);
  const retryRun = useRetryRun(runId);
  const notifications = useNotifications();

  if (run.isLoading || !run.data) {
    return (
      <QueryState
        title="Загружается срез запуска"
        description="Получаем snapshot, согласования, результаты и состояние отправки."
      />
    );
  }

  const relatedNotifications = (notifications.data?.items ?? []).filter((item) => {
    const workflowRunId = (item.metadata?.workflowRunId as string | undefined) ?? null;
    return item.entityId === run.data.id || workflowRunId === run.data.id;
  });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">исполнительный контур</Badge>
            <Badge variant={badgeVariantForStatus(run.data.status)}>{formatStatus(run.data.status)}</Badge>
            <Badge variant={badgeVariantForStatus(run.data.approvalState)}>
              согласование {formatStatus(run.data.approvalState)}
            </Badge>
            {run.data.externalRunId ? <Badge variant="muted">{run.data.externalRunId}</Badge> : null}
          </div>
          <CardTitle>{run.data.title}</CardTitle>
          <CardDescription>
            Страница запуска на основе snapshot с явными согласованиями, результатами и запросами отправки.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="Trace" value={run.data.traceId} />
            <Info label="Текущий шаг" value={run.data.currentStep} />
            <Info label="Начат" value={formatDateTime(run.data.startedAt)} />
            <Info label="Завершён" value={formatDateTime(run.data.finishedAt)} />
          </div>

          {run.data.errorCode ? (
            <div className="rounded-[20px] border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {run.data.errorCode}: {run.data.errorMessage ?? "Ошибка выполнения"}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => void cancelRun.mutateAsync()}
              disabled={cancelRun.isPending || !run.data.allowedActions.includes("cancel")}
            >
              Отменить запуск
            </Button>
            <Button
              onClick={() => void retryRun.mutateAsync()}
              disabled={retryRun.isPending || !run.data.allowedActions.includes("retry_run")}
            >
              Повторить запуск
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">шаги</Badge>
          <CardTitle>Выполнение шагов</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {run.data.steps.map((step) => (
            <RunStepCard key={step.id} runId={runId} step={step} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">approvals</Badge>
          <CardTitle>Контуры согласования</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {run.data.approvalTasks.length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
              Для этого запуска нет задач согласования.
            </div>
          ) : (
            run.data.approvalTasks.map((task) => <RunApprovalCard key={task.id} task={task} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">отправка</Badge>
          <CardTitle>Email-отправка</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {run.data.deliveryRequests.length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
              Запрос на отправку ещё не создан.
            </div>
          ) : (
            run.data.deliveryRequests.map((request) => (
              <RunDeliveryCard key={request.id} request={request} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">artifacts</Badge>
          <CardTitle>Результаты и документы</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {run.data.artifacts.length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
              Результаты появятся здесь после того, как runtime callback сохранит выходные данные в документный домен.
            </div>
          ) : (
            run.data.artifacts.map((artifact) => <RunArtifactCard key={artifact.id} artifact={artifact} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">notifications</Badge>
          <CardTitle>Связанные уведомления</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {relatedNotifications.length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
              По этому запуску пока нет уведомлений.
            </div>
          ) : (
            relatedNotifications.map((item) => (
              <div
                key={item.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForStatus(item.severity)}>{formatStatus(item.severity)}</Badge>
                  <Badge variant="muted">{item.type}</Badge>
                </div>
                <div className="mt-2 text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{item.body}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunStepCard({
  runId,
  step,
}: {
  readonly runId: string;
  readonly step: RunStepDetail;
}) {
  const retry = useRetryRunStep(runId, step.stepCode);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{step.stepCode}</Badge>
            <Badge variant={badgeVariantForStatus(step.status)}>{formatStatus(step.status)}</Badge>
            {step.requiresApproval ? <Badge variant="accent">согласование</Badge> : null}
          </div>
          <div className="text-sm font-medium">{step.moduleCode}</div>
          <div className="text-xs text-[color:var(--muted)]">
            попыток {step.attemptCount} • последнее событие {formatDateTime(step.lastEventAt)}
          </div>
          {step.errorCode ? (
            <div className="text-xs text-rose-300">
              {step.errorCode}: {step.errorMessage ?? "Ошибка"}
            </div>
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void retry.mutateAsync()}
          disabled={
            retry.isPending ||
            !["failed", "failed_retryable", "failed_permanent"].includes(step.status)
          }
        >
          Повторить шаг
        </Button>
      </div>
    </div>
  );
}

function RunApprovalCard({
  task,
}: {
  readonly task: ApprovalTaskDetail;
}) {
  const approve = useApproveApprovalTask(task.id);
  const reject = useRejectApprovalTask(task.id);
  const requestChanges = useRequestApprovalTaskChanges(task.id);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(task.status)}>{formatStatus(task.status)}</Badge>
            <Badge variant="muted">{task.kind}</Badge>
          </div>
          <div className="text-sm font-medium">{task.title}</div>
          <div className="text-xs text-[color:var(--muted)]">
            срок {formatDateTime(task.dueAt)} • истекает {formatDateTime(task.expiresAt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void approve.mutateAsync({ comment: "Approved on run page" })}
            disabled={approve.isPending || task.status !== "pending"}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void requestChanges.mutateAsync({ comment: "Needs changes" })}
            disabled={requestChanges.isPending || task.status !== "pending"}
          >
            Request changes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reject.mutateAsync({ comment: "Rejected on run page" })}
            disabled={reject.isPending || task.status !== "pending"}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function RunDeliveryCard({
  request,
}: {
  readonly request: DeliveryRequestSummary;
}) {
  const approve = useApproveDeliveryRequest(request.id);
  const send = useSendDeliveryRequest(request.id);
  const cancel = useCancelDeliveryRequest(request.id);
  const retry = useRetryDeliveryRequest(request.id);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(request.status)}>{formatStatus(request.status)}</Badge>
            <Badge variant="muted">{request.channel}</Badge>
          </div>
          <div className="text-sm font-medium">{request.title}</div>
          <div className="text-xs text-[color:var(--muted)]">
            получателей {request.recipientEmails.length} • вложений {request.attachmentArtifactIds.length}
          </div>
          {request.approvalTaskId ? (
            <Link className="text-xs text-[color:var(--accent-strong)] underline" href="/approvals">
              Открыть входящие согласований
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void approve.mutateAsync()}
            disabled={approve.isPending || request.status !== "waiting_approval"}
          >
            Approve
          </Button>
          <Button
            size="sm"
            onClick={() => void send.mutateAsync()}
            disabled={send.isPending || request.status !== "approved"}
          >
            Send
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cancel.mutateAsync()}
            disabled={cancel.isPending || !["approved", "waiting_approval"].includes(request.status)}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void retry.mutateAsync()}
            disabled={retry.isPending || request.status !== "failed_retryable"}
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function RunArtifactCard({
  artifact,
}: {
  readonly artifact: RunArtifact;
}) {
  const signedUrl = useCreateArtifactSignedUrl(artifact.id);
  const accept = useAcceptArtifactAsDocument(artifact.id);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{artifact.artifactType}</Badge>
            <Badge variant="muted">{artifact.source}</Badge>
          </div>
          <div className="text-sm font-medium">{artifact.title}</div>
          <div className="text-xs text-[color:var(--muted)]">{artifact.mimeType}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void signedUrl.mutateAsync({
                objectRole: "original",
                purpose: "download",
              }).then((response) => {
                window.open(response.signedUrl, "_blank", "noopener,noreferrer");
              });
            }}
          >
            Защищённая ссылка
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void accept.mutateAsync()}
            disabled={accept.isPending}
          >
            Принять как документ
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/documents/${artifact.documentId}`}>{t("Open document")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm text-[color:var(--muted-strong)] break-all">{value}</div>
    </div>
  );
}
