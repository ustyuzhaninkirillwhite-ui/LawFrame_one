"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
  Archive,
  Bot,
  Clock,
  CircleDot,
  Combine,
  FileText,
  Files,
  GitBranch,
  Mail,
  OctagonAlert,
  Play,
  Repeat2,
  ShieldCheck,
  StickyNote,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CanvasNodeBadge,
  CanvasNodeData,
  CanvasNodeHandleView,
} from "../lib/canvas-projection";

const iconByKind = {
  trigger: Play,
  legalAction: FileText,
  aiAction: Bot,
  documentInput: Files,
  condition: GitBranch,
  loop: Repeat2,
  merge: Combine,
  approval: ShieldCheck,
  wait: Clock,
  delivery: Mail,
  storage: Archive,
  subworkflow: Workflow,
  errorHandler: TriangleAlert,
  end: CircleDot,
  note: StickyNote,
  group: StickyNote,
} as const;

function CanvasNode(props: NodeProps) {
  const data = props.data as CanvasNodeData;
  return <BaseWorkflowNode data={data} selected={props.selected} />;
}

function BaseWorkflowNode({
  data,
  selected,
}: {
  readonly data: CanvasNodeData;
  readonly selected?: boolean;
}) {
  const Icon = iconByKind[data.nodeKind] ?? FileText;
  const danger = data.validation.state === "invalid";
  const warning = data.validation.state === "warning";
  const requiredInputs =
    data.noCode?.inputs.filter((input) => input.required).length ??
    data.inputSummary.required;
  const resolvedInputs =
    data.noCode?.inputs.filter(
      (input) => input.required && input.current_source,
    ).length ?? data.inputSummary.bound;
  const missingInputs =
    data.noCode?.inputs.filter(
      (input) => input.required && !input.current_source,
    ).length ?? data.inputSummary.missing;
  const outputLabel =
    data.noCode?.outputs[0]?.label ?? data.outputSummary.mainOutputLabel;

  return (
    <article
      aria-label={data.ariaLabel}
      className={cn(
        "relative min-h-[112px] w-[288px] rounded-[8px] border bg-[#111722] p-3 text-[#f5f2ea] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition-colors",
        selected ? "border-[color:var(--accent)]" : "border-[color:var(--line)]",
        danger ? "border-[color:var(--danger)]" : null,
        warning && !danger ? "border-[color:var(--accent)]/70" : null,
        data.readOnly ? "opacity-80" : null,
      )}
    >
      <NodeHandles handles={data.handles} direction="input" />

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-[8px] border border-[color:var(--line)] bg-white/6",
            data.nodeKind === "delivery" ? "text-[color:var(--danger)]" : null,
            data.nodeKind === "approval" ? "text-[color:var(--success)]" : null,
            data.nodeKind === "aiAction" ? "text-[color:var(--accent-strong)]" : null,
          )}
        >
          <Icon aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-5">
            {data.title}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
            {data.subtitle ?? data.moduleCode ?? data.nodeKind}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[color:var(--muted)]">
        <SummaryPill
          label="Нужны данные"
          value={`${resolvedInputs}/${requiredInputs}`}
          danger={missingInputs > 0}
        />
        <SummaryPill
          label="Создаёт"
          value={String(data.noCode?.outputs.length ?? data.outputSummary.count)}
          title={outputLabel}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={badgeVariantForValidation(data.validation.state)}>
          {validationLabel(data.validation.state)}
        </Badge>
        {data.noCode?.risk.requires_attention ? (
          <Badge variant={data.noCode.risk.level === "critical" ? "danger" : "accent"}>
            {data.noCode.risk.label}
          </Badge>
        ) : null}
        {data.badges.map((badge) => (
          <Badge key={`${badge.type}:${badge.label}`} variant={badgeVariant(badge)}>
            {badge.type === "error" || badge.type === "warning" ? (
              <OctagonAlert aria-hidden className="mr-1 size-3" />
            ) : null}
            {badge.label}
          </Badge>
        ))}
      </div>

      <NodeHandles handles={data.handles} direction="output" />
    </article>
  );
}

function SummaryPill({
  label,
  value,
  danger,
  title,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
  readonly title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "flex items-center justify-between gap-2 rounded-[6px] border border-[color:var(--line)] bg-black/18 px-2 py-1",
        danger ? "border-[color:var(--danger)]/45 text-[color:var(--danger)]" : null,
      )}
    >
      <span>{label}</span>
      <strong className="text-[#f5f2ea]">{value}</strong>
    </div>
  );
}

function NodeHandles({
  handles,
  direction,
}: {
  readonly handles: readonly CanvasNodeHandleView[];
  readonly direction: "input" | "output";
}) {
  const controlHandles = handles.filter(
    (handle) => handle.direction === direction && !isDataHandle(handle),
  );
  const dataHandles = handles.filter(
    (handle) => handle.direction === direction && isDataHandle(handle),
  );

  return (
    <>
      {controlHandles.map((handle, index) => (
        <HandleDot
          key={handle.code}
          handle={handle}
          type={direction === "input" ? "target" : "source"}
          position={direction === "input" ? Position.Top : Position.Bottom}
          index={index}
          count={controlHandles.length}
        />
      ))}
      {dataHandles.map((handle, index) => (
        <HandleDot
          key={handle.code}
          handle={handle}
          type={direction === "input" ? "target" : "source"}
          position={direction === "input" ? Position.Left : Position.Right}
          index={index}
          count={dataHandles.length}
          dataHandle
        />
      ))}
    </>
  );
}

function HandleDot({
  handle,
  type,
  position,
  index,
  count,
  dataHandle,
}: {
  readonly handle: CanvasNodeHandleView;
  readonly type: "source" | "target";
  readonly position: Position;
  readonly index: number;
  readonly count: number;
  readonly dataHandle?: boolean;
}) {
  const offset =
    count <= 1 ? "50%" : `${18 + (index * 64) / Math.max(count - 1, 1)}%`;
  const sideOffset =
    count <= 1 ? "50%" : `${26 + (index * 48) / Math.max(count - 1, 1)}%`;
  const style =
    position === Position.Top || position === Position.Bottom
      ? { left: offset }
      : { top: sideOffset };

  return (
    <Handle
      id={handle.code}
      type={type}
      position={position}
      title={handle.label}
      aria-label={handle.label}
      style={style}
      className={cn(
        "!size-2.5 !border-[color:var(--accent)] !bg-[#101319]",
        dataHandle ? "!size-2 !border-[color:var(--muted)]" : null,
      )}
    />
  );
}

function isDataHandle(handle: CanvasNodeHandleView) {
  return (
    handle.kind === "data_in" ||
    handle.kind === "data_out" ||
    handle.code.startsWith("data:input:") ||
    handle.code.startsWith("data:output:")
  );
}

function badgeVariant(badge: CanvasNodeBadge) {
  if (badge.type === "error" || badge.type === "external") {
    return "danger" as const;
  }
  if (badge.type === "ai" || badge.type === "approval" || badge.type === "policy") {
    return "accent" as const;
  }
  return "muted" as const;
}

function badgeVariantForValidation(state: CanvasNodeData["validation"]["state"]) {
  if (state === "invalid") {
    return "danger" as const;
  }
  if (state === "valid") {
    return "success" as const;
  }
  return "muted" as const;
}

function validationLabel(state: CanvasNodeData["validation"]["state"]) {
  switch (state) {
    case "valid":
      return "Настроен";
    case "invalid":
      return "Ошибка";
    case "warning":
      return "Внимание";
    default:
      return "Не тестирован";
  }
}

const MemoCanvasNode = React.memo(CanvasNode);

export const canvasNodeTypes = {
  trigger: MemoCanvasNode,
  legalAction: MemoCanvasNode,
  aiAction: MemoCanvasNode,
  documentInput: MemoCanvasNode,
  condition: MemoCanvasNode,
  loop: MemoCanvasNode,
  merge: MemoCanvasNode,
  approval: MemoCanvasNode,
  wait: MemoCanvasNode,
  delivery: MemoCanvasNode,
  storage: MemoCanvasNode,
  subworkflow: MemoCanvasNode,
  errorHandler: MemoCanvasNode,
  end: MemoCanvasNode,
  note: MemoCanvasNode,
  group: MemoCanvasNode,
};
