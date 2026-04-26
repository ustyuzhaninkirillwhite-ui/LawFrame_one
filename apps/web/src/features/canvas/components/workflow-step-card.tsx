"use client";

import type { WorkflowNode, ValidationIssue } from "@lexframe/contracts";
import { Handle, Position } from "@xyflow/react";
import {
  Bot,
  Archive,
  CheckCircle2,
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
  StickyNote,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const iconByType = {
  trigger: Play,
  legalAction: FileText,
  aiAction: Bot,
  documentInput: Files,
  condition: GitBranch,
  loop: Repeat2,
  merge: Combine,
  approval: CheckCircle2,
  wait: Clock,
  delivery: Mail,
  storage: Archive,
  subworkflow: Workflow,
  errorHandler: TriangleAlert,
  end: CircleDot,
  note: StickyNote,
  group: StickyNote,
} as const;

export function WorkflowStepCard({
  node,
  issues,
  selected,
}: {
  readonly node: WorkflowNode;
  readonly issues: readonly ValidationIssue[];
  readonly selected?: boolean;
}) {
  const Icon = iconByType[node.type] ?? FileText;
  const hasError = issues.some((issue) => issue.severity === "error");
  const hasPolicyBlock = issues.some((issue) => issue.severity === "policy_block");

  return (
    <div
      className={cn(
        "relative min-h-[104px] w-[288px] rounded-[8px] border bg-[#111722] p-3 text-[#f5f2ea] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition-colors",
        selected ? "border-[color:var(--accent)]" : "border-[color:var(--line)]",
        hasError || hasPolicyBlock ? "border-[color:var(--danger)]" : null,
        node.disabled ? "opacity-55" : null,
      )}
    >
      {node.handles
        .filter((handle) => handle.direction === "input" && !isDataHandle(handle))
        .map((handle) => (
          <Handle
            key={handle.code}
            id={handle.code}
            type="target"
            position={Position.Top}
            className="!size-2 !border-[color:var(--accent)] !bg-[#101319]"
          />
        ))}

      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-[8px] border border-[color:var(--line)] bg-white/6">
          <Icon aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-5">
            {node.display_name}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
            {node.description ?? node.module_code ?? node.type}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="muted">{node.type}</Badge>
        {node.policy.ai_action ? <Badge variant="accent">AI</Badge> : null}
        {node.policy.external_action ? <Badge variant="danger">external</Badge> : null}
        {node.policy.approval_required ? (
          <Badge variant="accent">approval</Badge>
        ) : null}
        {node.inputs.length > 0 ? (
          <Badge variant="muted">{node.inputs.length} in</Badge>
        ) : null}
        {node.outputs.length > 0 ? (
          <Badge variant="muted">{node.outputs.length} out</Badge>
        ) : null}
        {(node.input_bindings?.length ?? 0) > 0 ? (
          <Badge variant="accent">{node.input_bindings?.length} bindings</Badge>
        ) : null}
        {issues.length > 0 ? (
          <Badge variant={hasError || hasPolicyBlock ? "danger" : "muted"}>
            <OctagonAlert aria-hidden />
            {issues.length}
          </Badge>
        ) : null}
      </div>

      {node.handles
        .filter((handle) => handle.direction === "output" && !isDataHandle(handle))
        .map((handle, index, list) => (
          <Handle
            key={handle.code}
            id={handle.code}
            type="source"
            position={Position.Bottom}
            style={{
              left:
                list.length === 1
                  ? "50%"
                  : `${20 + (index * 60) / Math.max(list.length - 1, 1)}%`,
            }}
            className="!size-2 !border-[color:var(--accent)] !bg-[#101319]"
          />
        ))}
    </div>
  );
}

function isDataHandle(handle: WorkflowNode["handles"][number]) {
  return (
    handle.kind === "data_in" ||
    handle.kind === "data_out" ||
    handle.code.startsWith("data:input:") ||
    handle.code.startsWith("data:output:")
  );
}
