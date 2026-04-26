"use client";

import type {
  CanvasSecurityContext,
  RuntimeImportPreviewResponse,
  RuntimeSyncStatusResponse,
  WorkflowDiffItem,
} from "@lexframe/contracts";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useRuntimeImportApply,
  useRuntimeImportPreview,
  useRuntimeImportReject,
  useRuntimeOverwrite,
  useRuntimePull,
  useRuntimeSyncStatus,
} from "../hooks/use-canvas-data";

export function RuntimeSyncPanel({
  automationId,
  security,
}: {
  readonly automationId: string;
  readonly security?: CanvasSecurityContext | null;
}) {
  const status = useRuntimeSyncStatus(automationId);
  const pull = useRuntimePull(automationId);
  const preview = useRuntimeImportPreview(automationId);
  const apply = useRuntimeImportApply(automationId);
  const reject = useRuntimeImportReject(automationId);
  const overwrite = useRuntimeOverwrite(automationId);
  const [open, setOpen] = React.useState(false);
  const previewData = preview.data ?? null;
  const statusData = status.data ?? null;
  const tone = toneForStatus(statusData?.sync_status);
  const decisions = security?.decisions ?? {};
  const canPull = decisions["runtime-pull"]?.allowed ?? true;
  const canPreviewImport = decisions["runtime-import-preview"]?.allowed ?? true;
  const canApplyImport = decisions["runtime-import-apply"]?.allowed ?? false;
  const canRejectImport = decisions["runtime-import-reject"]?.allowed ?? true;
  const canOverwriteRuntime = decisions["runtime-overwrite"]?.allowed ?? false;

  async function pullAndPreview() {
    const pulled = await pull.mutateAsync({ source: "manual_pull" });
    if (pulled.snapshot_id) {
      await preview.mutateAsync({
        snapshot_id: pulled.snapshot_id,
        mode: "safe",
      });
      setOpen(true);
    }
  }

  if (!statusData && status.isLoading) {
    return null;
  }

  return (
    <section className="border-b border-[color:var(--line)] bg-[#0f151f] px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <RuntimeStatusBadge status={statusData} tone={tone} />
        {statusData?.warnings?.[0] ? (
          <span className="text-sm text-[color:var(--muted)]">
            {statusData.warnings[0]}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="subtle"
            onClick={() => {
              void pullAndPreview();
            }}
            disabled={
              pull.isPending || preview.isPending || !canPull || !canPreviewImport
            }
          >
            {pull.isPending || preview.isPending ? "Проверяем..." : "Pull"}
          </Button>
          {previewData ? (
            <Button
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
            >
              Diff
            </Button>
          ) : null}
          {previewData?.draft_candidate_id ? (
            <Button
              onClick={() => {
                void apply.mutateAsync({
                  draft_candidate_id: previewData.draft_candidate_id!,
                  resolution: "create_new_draft",
                });
              }}
              disabled={apply.isPending || !canApplyImport}
            >
              {apply.isPending ? "Импорт..." : "Import draft"}
            </Button>
          ) : null}
          {previewData?.draft_candidate_id || previewData?.runtime_graph ? (
            <Button
              variant="ghost"
              onClick={() => {
                void reject.mutateAsync({
                  draft_candidate_id: previewData?.draft_candidate_id ?? null,
                  reason: "Rejected from Canvas review panel",
                });
              }}
              disabled={reject.isPending || !canRejectImport}
            >
              Reject
            </Button>
          ) : null}
          {statusData?.runtime_changed ? (
            <Button
              variant="ghost"
              onClick={() => {
                void overwrite.mutateAsync({
                  confirm_discard_runtime_changes: true,
                });
              }}
              disabled={overwrite.isPending || !canOverwriteRuntime}
            >
              Overwrite runtime
            </Button>
          ) : null}
        </div>
      </div>

      {previewData && open ? <RuntimeDiffDrawer preview={previewData} /> : null}
      {previewData?.status === "import_blocked" ? (
        <PolicyBlockedImportDialog preview={previewData} />
      ) : null}
      {statusData?.sync_status === "conflict" ? (
        <ConflictResolutionDialog status={statusData} />
      ) : null}
    </section>
  );
}

function RuntimeStatusBadge({
  status,
  tone,
}: {
  readonly status: RuntimeSyncStatusResponse | null;
  readonly tone: "accent" | "danger" | "muted" | "success";
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={tone}>{labelForStatus(status?.sync_status)}</Badge>
      {status?.current_runtime_snapshot_hash ? (
        <span className="font-mono text-[11px] text-[color:var(--muted)]">
          {status.current_runtime_snapshot_hash.slice(0, 10)}
        </span>
      ) : null}
    </div>
  );
}

function RuntimeDiffDrawer({
  preview,
}: {
  readonly preview: RuntimeImportPreviewResponse;
}) {
  return (
    <div className="mt-3 max-h-[320px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[#0b0f15] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={preview.status === "import_preview_ready" ? "success" : "danger"}>
          {preview.importability}
        </Badge>
        <span className="text-sm text-[color:var(--muted)]">
          {preview.diff.length} changes
        </span>
      </div>
      <div className="grid gap-2">
        {preview.diff.map((item) => (
          <DiffItem key={item.id} item={item} />
        ))}
        {preview.diff.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">
            Semantic diff is empty.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PolicyBlockedImportDialog({
  preview,
}: {
  readonly preview: RuntimeImportPreviewResponse;
}) {
  const policyBlocks =
    preview.policy_blocks.length > 0 ? preview.policy_blocks : preview.diff;
  return (
    <div className="mt-3 rounded-[8px] border border-red-500/35 bg-red-500/10 p-3">
      <Badge variant="danger">Policy blocked</Badge>
      <div className="mt-2 grid gap-2">
        {policyBlocks.slice(0, 4).map((item) => (
          <DiffItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ConflictResolutionDialog({
  status,
}: {
  readonly status: RuntimeSyncStatusResponse;
}) {
  return (
    <div className="mt-3 rounded-[8px] border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-100">
      <Badge variant="accent">Conflict</Badge>
      <span className="ml-2">
        Canvas hash {shortHash(status.canonical_workflow_hash)} and runtime hash{" "}
        {shortHash(status.current_runtime_snapshot_hash)} both need review.
      </span>
    </div>
  );
}

function DiffItem({ item }: { readonly item: WorkflowDiffItem }) {
  return (
    <article className="rounded-[8px] border border-[color:var(--line)] bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeForSeverity(item.severity)}>{item.severity}</Badge>
        <strong className="text-sm text-[color:var(--text)]">{item.title}</strong>
      </div>
      <p className="mt-1 text-sm text-[color:var(--muted)]">{item.message}</p>
      {item.recommended_action ? (
        <p className="mt-1 text-xs text-[color:var(--muted-strong)]">
          {item.recommended_action}
        </p>
      ) : null}
    </article>
  );
}

function labelForStatus(status: RuntimeSyncStatusResponse["sync_status"] | undefined) {
  switch (status) {
    case "synced":
      return "Runtime synced";
    case "runtime_modified":
    case "importable":
      return "Runtime modified";
    case "import_requires_review":
      return "Review required";
    case "import_blocked_by_policy":
      return "Import blocked";
    case "unknown_runtime_nodes":
      return "Unknown runtime";
    case "conflict":
      return "Conflict";
    case "runtime_unavailable":
      return "Runtime unavailable";
    default:
      return "Runtime status";
  }
}

function toneForStatus(status: RuntimeSyncStatusResponse["sync_status"] | undefined) {
  switch (status) {
    case "synced":
      return "success";
    case "runtime_modified":
    case "importable":
    case "import_requires_review":
      return "accent";
    case "import_blocked_by_policy":
    case "unknown_runtime_nodes":
    case "conflict":
      return "danger";
    default:
      return "muted";
  }
}

function badgeForSeverity(severity: WorkflowDiffItem["severity"]) {
  if (severity === "policy_block" || severity === "conflict") {
    return "danger";
  }
  if (severity === "requires_review" || severity === "warning") {
    return "accent";
  }
  return "muted";
}

function shortHash(value: string | null) {
  return value ? value.slice(0, 10) : "n/a";
}
