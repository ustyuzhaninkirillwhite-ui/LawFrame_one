"use client";

import type { AutomationDataClassification, AutomationPlannerEventType } from "@lexframe/contracts";
import { ExternalLink, RotateCw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionBridge } from "@/providers/session-provider";
import { createAutomationBuilderApi } from "../api/automationBuilderApi";
import {
  deriveAutomationBuilderStage,
  hasBlockingReadiness,
  readinessStatusLabel,
} from "../domain/automationBuilderMappers";
import type {
  AutomationBlueprint,
  AutomationBlueprintValidationSummary,
  AutomationCanvasDraftResponse,
  AutomationCompilePreviewResponse,
  AutomationIntent,
  AutomationRuntimeDraftResponse,
  Stage20ReadinessResponse,
} from "../domain/automationBuilderTypes";
import { AutomationBlueprintPreview } from "./AutomationBlueprintPreview";
import { AutomationBuilderProgress } from "./AutomationBuilderProgress";
import { AutomationClarificationPanel } from "./AutomationClarificationPanel";
import { AutomationIntentForm } from "./AutomationIntentForm";
import { BlueprintApprovalPanel } from "./BlueprintApprovalPanel";
import { BlueprintCompilePreview } from "./BlueprintCompilePreview";
import { BlueprintContextPanel } from "./BlueprintContextPanel";
import { BlueprintRiskPanel } from "./BlueprintRiskPanel";
import { BlueprintValidationRail } from "./BlueprintValidationRail";
import { RuntimeDraftCreationPanel } from "./RuntimeDraftCreationPanel";

export function AutomationBuilderShell({
  projectId,
  initialIntentId,
  initialBlueprintId,
}: {
  readonly projectId: string;
  readonly initialIntentId?: string | null;
  readonly initialBlueprintId?: string | null;
}) {
  const router = useRouter();
  const { apiClient, sessionContext } = useSessionBridge();
  const api = React.useMemo(() => createAutomationBuilderApi(apiClient), [apiClient]);
  const [intent, setIntent] = React.useState<AutomationIntent | null>(null);
  const [blueprint, setBlueprint] = React.useState<AutomationBlueprint | null>(null);
  const [validation, setValidation] =
    React.useState<AutomationBlueprintValidationSummary | null>(null);
  const [compilePreview, setCompilePreview] =
    React.useState<AutomationCompilePreviewResponse | null>(null);
  const [canvasDraft, setCanvasDraft] =
    React.useState<AutomationCanvasDraftResponse | null>(null);
  const [runtimeDraft, setRuntimeDraft] =
    React.useState<AutomationRuntimeDraftResponse | null>(null);
  const [readiness, setReadiness] = React.useState<Stage20ReadinessResponse | null>(null);
  const [events, setEvents] = React.useState<AutomationPlannerEventType[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const permissions = sessionContext.permissions;
  const canCreateIntent = permissions.includes("automation_builder.create_intent");
  const canPlan = permissions.includes("automation_builder.plan");
  const canApprove = permissions.includes("automation_builder.approve_blueprint");
  const canCreateRuntime = permissions.includes("automation_builder.create_runtime_draft");
  const canViewDiagnostics = permissions.includes("automation_builder.view_route_snapshot");

  const stage = deriveAutomationBuilderStage({
    intent,
    blueprint,
    runtimeCreated: Boolean(runtimeDraft),
    canvasCreated: Boolean(canvasDraft),
  });

  const refreshBlueprint = React.useCallback(
    async (blueprintId: string) => {
      const nextBlueprint = await api.getBlueprint(blueprintId);
      setBlueprint(nextBlueprint);
      setValidation(nextBlueprint.validationSummary);
    },
    [api],
  );

  React.useEffect(() => {
    api.getReadiness().then(setReadiness).catch(() => setReadiness(null));
  }, [api]);

  React.useEffect(() => {
    if (!initialIntentId) {
      return;
    }

    let disposed = false;
    api
      .getIntent(initialIntentId)
      .then((response) => {
        if (disposed) {
          return;
        }
        setIntent(response.intent);
        if (response.latestBlueprint) {
          setBlueprint(response.latestBlueprint);
          setValidation(response.latestBlueprint.validationSummary);
        }
      })
      .catch((cause) => {
        if (!disposed) {
          setError(normalizeError(cause));
        }
      });

    return () => {
      disposed = true;
    };
  }, [api, initialIntentId]);

  React.useEffect(() => {
    if (!initialBlueprintId) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBlueprint(initialBlueprintId).catch((cause) => setError(normalizeError(cause)));
  }, [initialBlueprintId, refreshBlueprint]);

  const guarded = React.useCallback(
    async (action: () => Promise<void>) => {
      setPending(true);
      setError(null);
      try {
        await action();
      } catch (cause) {
        setError(normalizeError(cause));
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const createIntentAndPlan = React.useCallback(
    async (input: {
      readonly goal: string;
      readonly classification: AutomationDataClassification;
    }) =>
      guarded(async () => {
        const created = await api.createIntent(projectId, {
          source: "automation_builder_page",
          title: input.goal.slice(0, 80),
          userGoal: input.goal,
          classification: input.classification,
        });
        setIntent(created.intent);
        router.replace(`/app/projects/${projectId}/automation-builder/${created.intent.id}`);

        const planned = await api.planIntent(created.intent.id);
        setIntent(planned.intent);
        setEvents([...planned.events]);
        if (planned.blueprint) {
          setBlueprint(planned.blueprint);
          setValidation(planned.blueprint.validationSummary);
        }
      }),
    [api, guarded, projectId, router],
  );

  const answerClarification = React.useCallback(
    async (questionId: string, answer: unknown) =>
      guarded(async () => {
        if (!intent) {
          return;
        }
        await api.answerClarification(intent.id, questionId, answer);
        const planned = await api.planIntent(intent.id);
        setIntent(planned.intent);
        setEvents([...planned.events]);
        if (planned.blueprint) {
          setBlueprint(planned.blueprint);
          setValidation(planned.blueprint.validationSummary);
        }
      }),
    [api, guarded, intent],
  );

  const planCurrentIntent = React.useCallback(
    () =>
      guarded(async () => {
        if (!intent) {
          return;
        }
        const planned = await api.planIntent(intent.id);
        setIntent(planned.intent);
        setEvents([...planned.events]);
        if (planned.blueprint) {
          setBlueprint(planned.blueprint);
          setValidation(planned.blueprint.validationSummary);
        }
      }),
    [api, guarded, intent],
  );

  const validateBlueprint = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        setValidation(await api.validateBlueprint(blueprint.id));
        await refreshBlueprint(blueprint.id);
      }),
    [api, blueprint, guarded, refreshBlueprint],
  );

  const compileBlueprint = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        setCompilePreview(await api.compilePreview(blueprint.id));
      }),
    [api, blueprint, guarded],
  );

  const approveBlueprint = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        setBlueprint(await api.approveBlueprint(blueprint.id));
      }),
    [api, blueprint, guarded],
  );

  const rejectBlueprint = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        await api.rejectBlueprint(blueprint.id);
        await refreshBlueprint(blueprint.id);
      }),
    [api, blueprint, guarded, refreshBlueprint],
  );

  const convertBlueprint = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        setCanvasDraft(await api.convertToCanvasDraft(blueprint.id));
        await refreshBlueprint(blueprint.id);
      }),
    [api, blueprint, guarded, refreshBlueprint],
  );

  const createRuntimeDraft = React.useCallback(
    () =>
      guarded(async () => {
        if (!blueprint) {
          return;
        }
        setRuntimeDraft(await api.createRuntimeDraft(blueprint.id));
        await refreshBlueprint(blueprint.id);
      }),
    [api, blueprint, guarded, refreshBlueprint],
  );

  const canPlanNow =
    canCreateIntent && canPlan && !pending && readiness?.status !== "unavailable";
  const runtimeAllowed =
    canCreateRuntime &&
    Boolean(blueprint?.validationSummary.canCreateRuntimeDraft) &&
    (blueprint?.status === "approved" ||
      blueprint?.status === "converted_to_canvas_draft" ||
      blueprint?.status === "runtime_projection_created");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-[color:var(--text)]">
            Automation Builder
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-strong)]">
            Intent → Blueprint → validation → Canvas draft → runtime draft.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={readiness?.status === "ready" ? "success" : "warning"}>
            {readinessStatusLabel(readiness)}
          </Badge>
          {hasBlockingReadiness(readiness) ? (
            <Badge variant="danger">blocking readiness check</Badge>
          ) : null}
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5" aria-hidden="true" />
              Действие отклонено
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          {!intent ? (
            <AutomationIntentForm
              disabled={!canPlanNow}
              onSubmit={createIntentAndPlan}
            />
          ) : (
            <IntentSummary
              intent={intent}
              canPlan={canPlan && !pending && !blueprint}
              onPlan={planCurrentIntent}
              onRestart={() =>
                router.push(`/app/projects/${projectId}/automation-builder`)
              }
            />
          )}

          <AutomationClarificationPanel
            questions={blueprint?.clarificationState.questions ?? []}
            disabled={pending}
            onAnswer={answerClarification}
          />

          <AutomationBlueprintPreview
            blueprint={blueprint}
            canViewDiagnostics={canViewDiagnostics}
          />

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !blueprint}
              onClick={() => void validateBlueprint()}
            >
              <RotateCw className="mr-2 size-4" aria-hidden="true" />
              Проверить Blueprint
            </Button>
            <Button
              type="button"
              variant="subtle"
              disabled={pending || !blueprint}
              onClick={() => void compileBlueprint()}
            >
              Показать compile preview
            </Button>
            {canvasDraft ? (
              <Button type="button" asChild>
                <a href={canvasDraft.canvasUrl}>
                  <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                  Открыть Canvas
                </a>
              </Button>
            ) : null}
          </div>

          <BlueprintApprovalPanel
            blueprint={blueprint}
            disabled={pending || !canApprove}
            onApprove={approveBlueprint}
            onReject={rejectBlueprint}
            onConvert={convertBlueprint}
          />
        </main>

        <aside className="space-y-5">
          <AutomationBuilderProgress stage={stage} pending={pending} events={events} />
          <BlueprintValidationRail validation={validation} />
          {blueprint ? <BlueprintRiskPanel blueprint={blueprint} /> : null}
          {blueprint ? <BlueprintContextPanel blueprint={blueprint} /> : null}
          <BlueprintCompilePreview preview={compilePreview} />
          <RuntimeDraftCreationPanel
            disabled={pending}
            canCreate={runtimeAllowed}
            runtimeDraft={runtimeDraft}
            onCreate={createRuntimeDraft}
          />
        </aside>
      </div>
    </div>
  );
}

function IntentSummary({
  intent,
  canPlan,
  onPlan,
  onRestart,
}: {
  readonly intent: AutomationIntent;
  readonly canPlan: boolean;
  readonly onPlan: () => void;
  readonly onRestart: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{intent.status}</Badge>
          <Badge variant="muted">{intent.classification}</Badge>
        </div>
        <CardTitle>{intent.title ?? "Automation Intent"}</CardTitle>
        <CardDescription>{intent.userGoal}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button type="button" disabled={!canPlan} onClick={onPlan}>
          Запустить planning
        </Button>
        <Button type="button" variant="outline" onClick={onRestart}>
          Новый Intent
        </Button>
      </CardContent>
    </Card>
  );
}

function normalizeError(cause: unknown) {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "Backend rejected the automation-builder action.";
}
