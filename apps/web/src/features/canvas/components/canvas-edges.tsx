"use client";

import type { EdgeProps } from "@xyflow/react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import { GitBranch, Plus, TriangleAlert } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CanvasEdgeData } from "../lib/canvas-projection";

function CanvasEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const data = props.data as CanvasEdgeData | undefined;
  const style = edgeStyle(data);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={style}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <EdgeInlineControls data={data} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function InvalidEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const data = props.data as CanvasEdgeData | undefined;
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          stroke: "var(--danger)",
          strokeDasharray: "6 6",
          strokeWidth: 2.4,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <Badge variant="danger">
            <TriangleAlert aria-hidden className="mr-1 size-3" />
            invalid
          </Badge>
          {data?.label ? (
            <div className="mt-1 rounded-[6px] bg-black/65 px-2 py-1 text-[11px] text-[#f5f2ea]">
              {data.label}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function EdgeInlineControls({ data }: { readonly data?: CanvasEdgeData }) {
  const [open, setOpen] = React.useState(false);
  const modules =
    data?.inlineModules
      ?.filter((item) => canAddModule(item.availability.status))
      .slice(0, 8) ?? [];

  if (!data) {
    return null;
  }

  return (
    <div className="relative flex items-center gap-2">
      {data.label ? (
        <Badge variant={data.validationState === "invalid" ? "danger" : "muted"}>
          <GitBranch aria-hidden className="mr-1 size-3" />
          {data.label}
        </Badge>
      ) : null}
      {!data.readOnly && data.edgeType === "control_flow" ? (
        <Button
          type="button"
          size="sm"
          variant="subtle"
          aria-label="Добавить блок между шагами"
          onClick={() => setOpen((value) => !value)}
        >
          <Plus aria-hidden data-icon="inline-start" />
        </Button>
      ) : null}
      {open ? (
        <div className="absolute left-1/2 top-9 z-50 w-64 -translate-x-1/2 rounded-[8px] border border-[color:var(--line)] bg-[#111722] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.38)]">
          <div className="px-2 pb-2 text-xs font-medium text-[color:var(--muted)]">
            Добавить следующий шаг
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-auto">
            {modules.length === 0 ? (
              <div className="px-2 py-3 text-xs text-[color:var(--muted)]">
                Нет доступных блоков.
              </div>
            ) : (
              modules.map((module) => (
                <button
                  key={module.module_code}
                  type="button"
                  className="rounded-[6px] px-2 py-2 text-left text-xs text-[#f5f2ea] hover:bg-white/8"
                  onClick={() => {
                    data.onInlineAdd?.(data.workflowEdgeId, module);
                    setOpen(false);
                  }}
                >
                  <span className="block font-medium">{module.display_name}</span>
                  <span className="line-clamp-1 text-[color:var(--muted)]">
                    {module.short_description}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function canAddModule(status: string) {
  return [
    "available",
    "available_with_warnings",
    "missing_connection",
    "missing_profile",
    "missing_template",
  ].includes(status);
}

function edgeStyle(data: CanvasEdgeData | undefined): React.CSSProperties {
  const edgeType = data?.edgeType ?? "control_flow";
  const invalid = data?.validationState === "invalid";
  const warning = data?.validationState === "warning";
  const color = invalid
    ? "var(--danger)"
    : edgeType === "data_flow"
      ? "var(--success)"
      : edgeType === "error_flow"
        ? "var(--danger)"
        : edgeType === "approval_flow"
          ? "var(--accent-strong)"
          : edgeType === "loop_flow"
            ? "#8bb7ff"
            : "var(--accent)";

  return {
    stroke: color,
    strokeWidth: invalid || warning ? 2.5 : 1.8,
    strokeDasharray:
      edgeType === "data_flow"
        ? "4 4"
        : edgeType === "disabled"
          ? "8 8"
          : undefined,
    opacity: data?.readOnly ? 0.62 : 0.92,
  };
}

const MemoCanvasEdge = React.memo(CanvasEdge);
const MemoInvalidEdge = React.memo(InvalidEdge);

export const canvasEdgeTypes = {
  control: MemoCanvasEdge,
  data: MemoCanvasEdge,
  error: MemoCanvasEdge,
  approval: MemoCanvasEdge,
  loop: MemoCanvasEdge,
  disabled: MemoCanvasEdge,
  invalid: MemoInvalidEdge,
};
