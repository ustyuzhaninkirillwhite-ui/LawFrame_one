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
import { useActivepiecesBackgroundCanvas } from "@/features/automation-canvas/activepieces-background-canvas-provider";
import { useSessionBridge } from "@/providers/session-provider";
import { ProjectAutomations } from "./project-automations";

const ENSURE_TIMEOUT_MS = 20_000;

type ReadinessState =
  | { readonly status: "idle"; readonly failure: null }
  | { readonly status: "loading"; readonly failure: null }
  | {
      readonly status: "failed";
      readonly failure: { readonly code: string; readonly message: string };
    };

type ReadinessAction =
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | {
      readonly type: "failed";
      readonly failure: { readonly code: string; readonly message: string };
    };

const initialReadinessState: ReadinessState = {
  status: "idle",
  failure: null,
};

function readinessReducer(
  state: ReadinessState,
  action: ReadinessAction,
): ReadinessState {
  switch (action.type) {
    case "idle":
      if (state.status === "idle") {
        return state;
      }
      return initialReadinessState;
    case "loading":
      if (state.status === "loading") {
        return state;
      }
      return { status: "loading", failure: null };
    case "failed":
      if (
        state.status === "failed" &&
        state.failure.code === action.failure.code &&
        state.failure.message === action.failure.message
      ) {
        return state;
      }
      return { status: "failed", failure: action.failure };
  }
}

export function ProjectAutomationsLanding({
  projectId,
}: {
  readonly projectId: string;
}) {
  const router = useRouter();
  const { apiClient } = useSessionBridge();
  const backgroundCanvas = useActivepiecesBackgroundCanvas();
  const {
    data: automationData,
    isLoading: automationsLoading,
    isSuccess: automationsSuccess,
    isError: automationsError,
    refetch: refetchAutomations,
  } = useStage15ProjectAutomations(projectId);
  const {
    isPending: ensureCanvasPending,
    isError: ensureCanvasError,
    mutate: ensureCanvasAutomation,
    reset: resetEnsureCanvas,
  } = useEnsureStage17CanvasAutomation(projectId);
  const ensureRequestedRef = React.useRef(false);
  const [ensureTimedOut, setEnsureTimedOut] = React.useState(false);
  const [readinessState, dispatchReadiness] = React.useReducer(
    readinessReducer,
    initialReadinessState,
  );
  const items = React.useMemo(() => automationData ?? [], [automationData]);
  const automationToOpen = React.useMemo(() => {
    const activepiecesReady = items.find(
      (item) =>
        item.canOpenBuilder &&
        Boolean(item.runtimeProjectId) &&
        Boolean(item.runtimeFlowId),
    );

    return activepiecesReady ?? null;
  }, [items]);
  const backgroundManagingProject =
    backgroundCanvas.activeProjectId === projectId &&
    backgroundCanvas.state.phase !== "idle";

  React.useEffect(() => {
    if (!ensureCanvasPending) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setEnsureTimedOut(true);
    }, ENSURE_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [ensureCanvasPending]);

  React.useEffect(() => {
    let cancelled = false;

    if (backgroundManagingProject) {
      if (
        backgroundCanvas.state.phase === "available" &&
        backgroundCanvas.route
      ) {
        router.replace(backgroundCanvas.route);
      }
      return () => {
        cancelled = true;
      };
    }

    if (automationToOpen) {
      dispatchReadiness({ type: "loading" });
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
          dispatchReadiness({
            type: "failed",
            failure: {
              code: readiness.readinessCode,
              message:
                readiness.message ??
                "Конструктор автоматизаций временно недоступен.",
            },
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          dispatchReadiness({
            type: "failed",
            failure: {
              code: "READINESS_CHECK_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Не удалось проверить готовность конструктора.",
            },
          });
        });
      return () => {
        cancelled = true;
      };
    }

    dispatchReadiness({ type: "idle" });

    if (
      automationsSuccess &&
      !ensureRequestedRef.current &&
      !ensureCanvasPending
    ) {
      ensureRequestedRef.current = true;
      setEnsureTimedOut(false);
      ensureCanvasAutomation(undefined, {
        onSuccess: (result) => {
          void refetchAutomations();
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
    automationsSuccess,
    backgroundCanvas.route,
    backgroundCanvas.state.phase,
    backgroundManagingProject,
    ensureCanvasAutomation,
    ensureCanvasPending,
    projectId,
    refetchAutomations,
    router,
  ]);

  if (backgroundManagingProject) {
    if (backgroundCanvas.state.phase === "unavailable") {
      return (
        <Card>
          <CardHeader>
            <Badge variant="danger">недоступно</Badge>
            <CardTitle>Не удалось открыть конструктор автоматизаций</CardTitle>
            <CardDescription>
              {backgroundCanvas.state.message ??
                "Конструктор автоматизаций временно недоступен."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={backgroundCanvas.retry}>
              <RotateCw className="mr-2 size-4" aria-hidden="true" />
              Повторить
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <QueryState
        title="Открываем конструктор автоматизаций"
        description={
          backgroundCanvas.state.message ??
          "Готовим сценарий Stage 23 и сразу откроем рабочее поле автоматизаций."
        }
      />
    );
  }

  if (
    automationsLoading ||
    readinessState.status === "loading" ||
    (ensureCanvasPending && !ensureTimedOut)
  ) {
    return (
      <QueryState
        title="Открываем конструктор автоматизаций"
        description="Готовим сценарий Stage 23 и сразу откроем рабочее поле автоматизаций."
      />
    );
  }

  if (automationsError || ensureCanvasError || ensureTimedOut) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">недоступно</Badge>
          <CardTitle>Не удалось открыть конструктор автоматизаций</CardTitle>
          <CardDescription>
            Старый canvas не используется как запасной режим. Проверьте runtime
            автоматизаций и повторите подготовку сценария Stage 23.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              ensureRequestedRef.current = false;
              setEnsureTimedOut(false);
              resetEnsureCanvas();
              if (automationsError) {
                void refetchAutomations();
                return;
              }
              ensureCanvasAutomation(undefined, {
                onSuccess: (result) => {
                  void refetchAutomations();
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

  if (readinessState.failure) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="danger">недоступно</Badge>
          <CardTitle>Конструктор автоматизаций временно недоступен</CardTitle>
          <CardDescription>{readinessState.failure.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              dispatchReadiness({ type: "idle" });
              void refetchAutomations();
            }}
          >
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
            Обновить состояние
          </Button>
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted-strong)]">
            <AlertCircle className="size-4" aria-hidden="true" />
            {readinessState.failure.code}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (automationToOpen) {
    return (
      <QueryState
        title="Открываем конструктор автоматизаций"
        description="В проекте один сценарий Stage 23, перенаправляем прямо в рабочее поле."
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
        <Badge variant="muted">Stage 23</Badge>
        <CardTitle>Подготавливаем конструктор автоматизаций</CardTitle>
        <CardDescription>
          Создаём недостающие runtime-привязки. Старый canvas не используется.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
