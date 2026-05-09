"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AlertCircle, RotateCw, Workflow } from "lucide-react";
import { QueryState } from "@/components/stage3-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useEnsureStage17CanvasAutomation,
  useStage15ProjectAutomations,
} from "@/hooks/domain/stage15";
import { useSessionBridge } from "@/providers/session-provider";
import { ProjectAutomations } from "./project-automations";

const ENSURE_TIMEOUT_MS = 20_000;

export function ProjectAutomationsLanding({
  projectId,
}: {
  readonly projectId: string;
}) {
  const router = useRouter();
  const { apiClient } = useSessionBridge();
  const automations = useStage15ProjectAutomations(projectId);
  const ensureCanvas = useEnsureStage17CanvasAutomation(projectId);
  const ensureRequestedRef = React.useRef(false);
  const [ensureTimedOut, setEnsureTimedOut] = React.useState(false);
  const [readinessFailure, setReadinessFailure] = React.useState<{
    readonly code: string;
    readonly message: string;
  } | null>(null);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const items = React.useMemo(() => automations.data ?? [], [automations.data]);
  const automationToOpen = React.useMemo(() => {
    const activepiecesReady = items.find(
      (item) =>
        item.canOpenBuilder &&
        Boolean(item.runtimeProjectId) &&
        Boolean(item.runtimeFlowId),
    );

    return activepiecesReady ?? null;
  }, [items]);

  React.useEffect(() => {
    if (!ensureCanvas.isPending) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setEnsureTimedOut(true);
    }, ENSURE_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [ensureCanvas.isPending]);

  React.useEffect(() => {
    let cancelled = false;

    if (automationToOpen) {
      setReadinessFailure(null);
      setReadinessLoading(true);
      void apiClient
        .getActivepiecesCanvasReadiness({
          projectId,
          automationId: automationToOpen.id,
        })
        .then((readiness) => {
          if (cancelled) {
            return;
          }
          if (
            readiness.status === "ready" ||
            readiness.status === "repaired"
          ) {
            router.replace(
              `/app/projects/${projectId}/automations/${automationToOpen.id}/automation`,
            );
            return;
          }
          setReadinessFailure({
            code: readiness.readinessCode,
            message:
              readiness.message ??
              "Конструктор автоматизаций временно недоступен.",
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setReadinessFailure({
            code: "READINESS_CHECK_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось проверить готовность конструктора.",
          });
        })
        .finally(() => {
          if (!cancelled) {
            setReadinessLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (!automationToOpen) {
      setReadinessFailure(null);
      setReadinessLoading(false);
    }

    if (automationToOpen) {
      return;
    }

    if (
      automations.isSuccess &&
      !ensureRequestedRef.current &&
      !ensureCanvas.isPending
    ) {
      ensureRequestedRef.current = true;
      setEnsureTimedOut(false);
      ensureCanvas.mutate(undefined, {
        onSuccess: (result) => {
          void automations.refetch();
          router.replace(result.route);
        },
        onError: () => {
          ensureRequestedRef.current = false;
        },
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    automationToOpen,
    automations,
    ensureCanvas,
    items,
    projectId,
    router,
  ]);

  if (
    automations.isLoading ||
    readinessLoading ||
    (ensureCanvas.isPending && !ensureTimedOut)
  ) {
    return (
      <QueryState
        title="Открываем конструктор автоматизаций"
        description="Готовим сценарий Stage 17 и сразу откроем рабочее поле автоматизаций."
      />
    );
  }

  if (automations.isError || ensureCanvas.isError || ensureTimedOut) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">недоступно</Badge>
          <CardTitle>Не удалось открыть конструктор автоматизаций</CardTitle>
          <CardDescription>
            Старый canvas не используется как запасной режим. Проверьте runtime
            автоматизаций и повторите подготовку сценария Stage 17.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              ensureRequestedRef.current = false;
              setEnsureTimedOut(false);
              ensureCanvas.reset();
              if (automations.isError) {
                void automations.refetch();
                return;
              }
              ensureCanvas.mutate(undefined, {
                onSuccess: (result) => {
                  void automations.refetch();
                  router.replace(result.route);
                },
              });
            }}
          >
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
            Повторить
          </Button>
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted-strong)]">
            <AlertCircle className="size-4" aria-hidden="true" />
            Резервный canvas отключён для пользовательского сценария.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (readinessFailure) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">недоступно</Badge>
          <CardTitle>Конструктор автоматизаций временно недоступен</CardTitle>
          <CardDescription>{readinessFailure.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setReadinessFailure(null);
              void automations.refetch();
            }}
          >
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
            Обновить состояние
          </Button>
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted-strong)]">
            <AlertCircle className="size-4" aria-hidden="true" />
            {readinessFailure.code}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (automationToOpen) {
    return (
      <QueryState
        title="Открываем конструктор автоматизаций"
        description="В проекте один сценарий Stage 17, перенаправляем прямо в рабочее поле."
      />
    );
  }

  if (items.length > 0) {
    return <ProjectAutomations projectId={projectId} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-[8px] border border-[color:var(--line)] bg-[color:var(--panel-muted)] text-[color:var(--accent)]">
          <Workflow className="size-5" aria-hidden="true" />
        </div>
        <Badge variant="muted">Stage 17</Badge>
        <CardTitle>Подготавливаем конструктор автоматизаций</CardTitle>
        <CardDescription>
          Создаём недостающие runtime-привязки. Старый canvas не используется.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
