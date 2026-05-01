"use client";

import type { LexFrameWorkflow, LexFrameWorkflowStep, Stage15UiStatus } from "@lexframe/contracts";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import { validWorkflowExample, validateWorkflowDefinition } from "@lexframe/workflow";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { Stage15StatusBadge } from "@/components/status/stage15-status";
import {
  useAutomationDetail,
  useAutomationRuntimeRequirements,
} from "@/hooks/domain/automations";
import {
  useWorkflowDraft,
  useWorkflowDrafts,
} from "@/hooks/domain/ai";
import { useMaterializeWorkflowDraft } from "@/hooks/domain/stage15";
import { formatStatus } from "@/lib/i18n";

interface BuilderFormValues {
  readonly title: string;
  readonly description: string;
  readonly requiresApproval: boolean;
}

const inspectorSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  requiresApproval: z.boolean(),
});

export function WorkflowBuilderV1({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const automation = useAutomationDetail(automationId);
  const runtime = useAutomationRuntimeRequirements(automationId);
  const drafts = useWorkflowDrafts();
  const draft =
    (drafts.data ?? []).find((item) => item.linkedAutomationId === automationId) ??
    drafts.data?.[0] ??
    null;
  const draftDetail = useWorkflowDraft(draft?.id);
  const materialize = useMaterializeWorkflowDraft(draft?.id);
  const workflow = draftDetail.data?.workflow ?? validWorkflowExample;
  const validation = React.useMemo(
    () => validateWorkflowDefinition(workflow),
    [workflow],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(workflow));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(workflow));
  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(
    workflow.steps[0]?.stepId ?? null,
  );
  const [uiStatusOverride, setUiStatusOverride] = React.useState<Stage15UiStatus | null>(
    null,
  );
  const effectiveSelectedStepId = workflow.steps.some((step) => step.stepId === selectedStepId)
    ? selectedStepId
    : workflow.steps[0]?.stepId ?? null;
  const selectedStep =
    workflow.steps.find((step) => step.stepId === effectiveSelectedStepId) ?? null;
  const uiStatus = uiStatusOverride ?? (validation.ok ? "saved" : "validation_failed");
  const form = useForm<BuilderFormValues>({
    defaultValues: {
      title: selectedStep?.title ?? "",
      description: selectedStep?.description ?? "",
      requiresApproval: selectedStep?.requiresApproval ?? false,
    },
  });

  React.useEffect(() => {
    setNodes(buildNodes(workflow));
    setEdges(buildEdges(workflow));
  }, [setEdges, setNodes, workflow]);

  React.useEffect(() => {
    form.reset({
      title: selectedStep?.title ?? "",
      description: selectedStep?.description ?? "",
      requiresApproval: selectedStep?.requiresApproval ?? false,
    });
  }, [form, selectedStep]);

  React.useEffect(() => {
    if (uiStatus !== "autosaving") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUiStatusOverride(null);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [uiStatus]);

  if (
    automation.isLoading ||
    runtime.isLoading ||
    drafts.isLoading ||
    draftDetail.isLoading ||
    !automation.data ||
    !runtime.data
  ) {
    return (
      <QueryState
        title="Загрузка LexFrame Builder"
        description="Получаем автоматизацию, runtime readiness и черновики workflow."
      />
    );
  }

  const applyInspector = form.handleSubmit((values) => {
    const parsed = inspectorSchema.safeParse(values);
    if (!parsed.success || !effectiveSelectedStepId) {
      setUiStatusOverride("validation_failed");
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === effectiveSelectedStepId
          ? {
              ...node,
              data: {
                ...node.data,
                label: parsed.data.title,
                description: parsed.data.description,
                requiresApproval: parsed.data.requiresApproval,
              },
            }
          : node,
      ),
    );
    setUiStatusOverride("autosaving");
  });

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">LexFrame Builder v1</Badge>
            <Stage15StatusBadge status={uiStatus} />
            <Badge variant={badgeVariantForStatus(automation.data.syncState)}>
              {formatStatus(automation.data.syncState)}
            </Badge>
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[0.92]">
            {automation.data.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--muted)]">
            Резервный Canvas показывает LexFrame workflow как продуктовый черновик; основной
            вход в рабочую автоматизацию открыт через управляемый контур LexFrame.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="ghost">
            <Link href={`/app/projects/${projectId}/automations/${automationId}/automation`}>
              Автоматизация
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!draft) {
                return;
              }

              void materialize.mutateAsync({
                projectId,
                title: draft.title,
                openInBuilder: true,
              });
            }}
            disabled={!draft || materialize.isPending}
          >
            Materialize
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={validation.ok ? "success" : "danger"}>
                {validation.ok ? "valid" : "invalid"}
              </Badge>
              <Badge variant={runtime.data.canRun ? "success" : "muted"}>
                {runtime.data.canRun ? "can run" : "runtime gated"}
              </Badge>
            </div>
            <CardTitle>{workflow.title}</CardTitle>
            <CardDescription>{workflow.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[640px] overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-[#10141c]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedStepId(node.id)}
                fitView
                nodesDraggable
                nodesConnectable={false}
              >
                <MiniMap pannable zoomable />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </CardContent>
        </Card>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <Badge variant="muted">Inspector</Badge>
              <CardTitle>Шаг workflow</CardTitle>
              <CardDescription>
                Изменения сохраняются как локальный draft state до появления backend patch endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedStep ? (
                <form className="grid gap-4" onSubmit={(event) => void applyInspector(event)}>
                  <label className="grid gap-2 text-sm">
                    Название
                    <Input {...form.register("title")} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Описание
                    <Textarea {...form.register("description")} rows={5} />
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" {...form.register("requiresApproval")} />
                    Требует согласование
                  </label>
                  <Button type="submit">Применить</Button>
                </form>
              ) : (
                <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
                  Выберите шаг на canvas.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="muted">Validation rail</Badge>
              <CardTitle>Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {validation.issues.length === 0 ? (
                <div className="rounded-[18px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Workflow проходит базовую семантическую проверку `@lexframe/workflow`.
                </div>
              ) : (
                validation.issues.map((issue) => (
                  <div
                    key={issue}
                    className="rounded-[18px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"
                  >
                    {issue}
                  </div>
                ))
              )}
              {runtime.data.missingConnections.map((connection) => (
                <div
                  key={connection.code}
                  className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4 text-sm"
                >
                  <Badge variant="danger">missing connection</Badge>
                  <div className="mt-2 font-medium">{connection.displayName}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {connection.provider} / {connection.code}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

interface WorkflowNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly description: string;
  readonly kind: LexFrameWorkflowStep["kind"];
  readonly moduleCode: string;
  readonly requiresApproval: boolean;
}

function buildNodes(workflow: LexFrameWorkflow): Node<WorkflowNodeData>[] {
  return workflow.steps.map((step, index) => ({
    id: step.stepId,
    position: {
      x: 120,
      y: index * 150 + 40,
    },
    data: {
      label: step.title,
      description: step.description,
      kind: step.kind,
      moduleCode: step.moduleCode,
      requiresApproval: step.requiresApproval,
    },
    style: {
      width: 280,
      borderRadius: 18,
      border: "1px solid rgba(245,236,220,0.18)",
      background: step.requiresApproval
        ? "rgba(248,154,138,0.12)"
        : "rgba(255,255,255,0.06)",
      color: "#f5f2ea",
      padding: 12,
    },
  }));
}

function buildEdges(workflow: LexFrameWorkflow): Edge[] {
  return workflow.transitions.map((transition) => ({
    id: `${transition.from}:${transition.to}:${transition.condition}`,
    source: transition.from,
    target: transition.to,
    label: transition.condition,
    animated: transition.condition !== "success",
  }));
}
