"use client";

import Link from "next/link";
import type {
  CanvasLockState,
  CanvasPermissions,
  CanvasVersionStateResponse,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
} from "@lexframe/contracts";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  GitCommitHorizontal,
  History,
  LayoutDashboard,
  Lock,
  MessageSquare,
  PanelLeft,
  Play,
  Rocket,
  Save,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { badgeVariantForStatus } from "@/components/stage3-shared";

export type CanvasSaveStatus = "saved" | "saving" | "dirty" | "failed" | "conflict";

export function CanvasHeader({
  projectId,
  automationId,
  workflow,
  workflowHash,
  versionState,
  validation,
  permissions,
  lock,
  pending,
  saveStatus,
  onValidate,
  onCompilePreview,
  onAutoArrange,
  onAcquireLock,
  onReleaseLock,
  onTogglePalette,
  onOpenChat,
  onOpenRunPreview,
  onOpenVersions,
  onOpenPublish,
  onOpenCommandPalette,
}: {
  readonly projectId: string;
  readonly automationId: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly workflowHash: string;
  readonly versionState?: CanvasVersionStateResponse | null;
  readonly validation: CanvasValidationSummary;
  readonly permissions: CanvasPermissions;
  readonly lock: CanvasLockState;
  readonly pending: boolean;
  readonly saveStatus: CanvasSaveStatus;
  readonly onValidate: () => void;
  readonly onCompilePreview: () => void;
  readonly onAutoArrange: () => void;
  readonly onAcquireLock: () => void;
  readonly onReleaseLock: () => void;
  readonly onTogglePalette: () => void;
  readonly onOpenChat: () => void;
  readonly onOpenRunPreview: () => void;
  readonly onOpenVersions: () => void;
  readonly onOpenPublish: () => void;
  readonly onOpenCommandPalette: () => void;
}) {
  const readOnly = !permissions.can_edit || lock.status === "locked_by_other";
  const capabilities = validation.capabilities ?? validation;
  const publishDisabled =
    pending || readOnly || !permissions.can_publish || !capabilities.can_publish;
  const compileDisabled =
    pending || !permissions.can_view_compile_preview || !capabilities.can_compile;
  const runPreviewDisabled = pending || !permissions.can_test || !capabilities.can_test;
  const activeVersion = versionState?.active_published_version;
  const runtimeStatus = versionState?.runtime_binding?.status ?? workflow.runtime_projection.status;
  const disabledState = versionState?.disabled_state.disabled === true;
  const hasRuntimeConflict = versionState?.runtime_conflict.has_conflict === true;

  return (
    <header className="flex flex-col gap-4 border-b border-[color:var(--line)] bg-[#0d1118]/92 px-5 py-4 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">Canvas v2</Badge>
          <Badge variant={badgeVariantForStatus(validation.status)}>
            {validationLabel(validation.status)}
          </Badge>
          <Badge variant={readOnly ? "muted" : "success"}>
            {readOnly ? "только просмотр" : "редактирование"}
          </Badge>
          <Badge variant="muted">{workflow.metadata.canvas_mode}</Badge>
          {activeVersion ? (
            <Badge variant="accent">
              v{activeVersion.version_no ?? "?"} {activeVersion.workflow_hash.slice(0, 8)}
            </Badge>
          ) : (
            <Badge variant="muted">no published version</Badge>
          )}
          <Badge variant={runtimeStatus === "synced" ? "success" : "muted"}>
            runtime {runtimeStatus}
          </Badge>
          {disabledState ? (
            <Badge variant="danger">
              <CircleSlash aria-hidden className="mr-1 size-3" />
              disabled
            </Badge>
          ) : null}
          {hasRuntimeConflict ? <Badge variant="danger">runtime conflict</Badge> : null}
          <Badge variant={saveBadgeVariant(saveStatus)}>
            <Save aria-hidden className="mr-1 size-3" />
            {saveStatusLabel(saveStatus)}
          </Badge>
          <Badge variant="muted">{workflowHash.slice(0, 8)}</Badge>
        </div>
        <h1 className="mt-3 truncate font-[family-name:var(--font-display)] text-3xl leading-none">
          {workflow.metadata.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
          <span>Статус: {workflow.metadata.status}</span>
          <span>Runtime: {workflow.runtime_projection.status}</span>
          <span>Revision: {workflow.revision_counter ?? 0}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/projects/${projectId}/automations/${automationId}`}>
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Детали
          </Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onTogglePalette}>
          <PanelLeft aria-hidden data-icon="inline-start" />
          Палитра
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenCommandPalette}
          data-canvas-command-trigger="true"
        >
          <Search aria-hidden data-icon="inline-start" />
          Команды
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onValidate}
          disabled={pending}
        >
          <CheckCircle2 aria-hidden data-icon="inline-start" />
          Validate
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCompilePreview}
          disabled={compileDisabled}
        >
          <GitCommitHorizontal aria-hidden data-icon="inline-start" />
          Compile preview
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAutoArrange}
          disabled={readOnly || pending || !permissions.can_edit_layout}
        >
          <LayoutDashboard aria-hidden data-icon="inline-start" />
          Auto-layout
        </Button>
        {lock.status === "locked_by_me" ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReleaseLock}>
            <Lock aria-hidden data-icon="inline-start" />
            Unlock
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAcquireLock}
            disabled={
              !permissions.can_edit || lock.status === "locked_by_other"
            }
          >
            <Lock aria-hidden data-icon="inline-start" />
            Lock
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={runPreviewDisabled}
          onClick={onOpenRunPreview}
        >
          <Play aria-hidden data-icon="inline-start" />
          Run preview
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={publishDisabled}
          onClick={onOpenPublish}
        >
          <Rocket aria-hidden data-icon="inline-start" />
          Publish
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenVersions}>
          <History aria-hidden data-icon="inline-start" />
          Versions
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!permissions.can_use_ai_assistant}
          onClick={onOpenChat}
        >
          <MessageSquare aria-hidden data-icon="inline-start" />
          Assistant
        </Button>
        {permissions.can_debug ? (
          <Button type="button" variant="ghost" size="sm" disabled>
            <Bug aria-hidden data-icon="inline-start" />
            Debug
          </Button>
        ) : null}
        {permissions.can_open_advanced_builder ? (
          <Button asChild size="sm">
            <Link
              href={`/app/projects/${projectId}/automations/${automationId}/advanced-builder`}
            >
              <ExternalLink aria-hidden data-icon="inline-start" />
              Advanced
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function validationLabel(status: CanvasValidationSummary["status"]) {
  if (status === "valid_with_warnings") {
    return "valid + warnings";
  }
  return status;
}

function saveStatusLabel(status: CanvasSaveStatus) {
  switch (status) {
    case "saving":
      return "saving";
    case "dirty":
      return "dirty";
    case "failed":
      return "failed";
    case "conflict":
      return "conflict";
    default:
      return "saved";
  }
}

function saveBadgeVariant(status: CanvasSaveStatus) {
  if (status === "failed" || status === "conflict") {
    return "danger" as const;
  }
  if (status === "saving" || status === "dirty") {
    return "muted" as const;
  }
  return "success" as const;
}
