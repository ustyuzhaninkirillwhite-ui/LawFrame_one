"use client";

import type {
  CanvasAiMessageResponse,
  CanvasAiPatchProposal,
  CanvasPermissions,
  CanvasPublishReport,
  CanvasRollbackType,
  CanvasRuntimeProjectionVersion,
  CanvasVersionCompareResponse,
  CanvasVersionExportResponse,
  CanvasVersionStateResponse,
  CanvasVersionSummary,
  CanvasVersionsResponse,
  LexFrameWorkflowV2,
} from "@lexframe/contracts";
import type { ReactNode } from "react";
import * as React from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  GitCompare,
  GitPullRequest,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCanvasAiExplain,
  useCanvasAiPatchApply,
  useCanvasAiPatchProposal,
  useCanvasAiPatchReject,
  useCanvasAiTestPlan,
  useCanvasEmergencyDisable,
  useCanvasPublish,
  useCanvasPublishValidate,
  useCanvasRollback,
  useCanvasRuntimeProjection,
  useCanvasVersionCompare,
  useCanvasVersionExport,
  useCanvasVersionRestore,
} from "../hooks/use-canvas-data";

export function CanvasSideDrawer({
  title,
  badge,
  open,
  onClose,
  children,
}: {
  readonly title: string;
  readonly badge: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45" role="presentation">
      <aside className="ml-auto flex h-full w-full max-w-md flex-col border-l border-[color:var(--line)] bg-[#0d1118] shadow-[0_20px_70px_rgba(0,0,0,0.42)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] p-4">
          <div>
            <Badge variant="muted">{badge}</Badge>
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function CanvasAiDrawer({
  automationId,
  workflowHash,
  selectedNodeId,
  readOnly,
  lockStatus,
  permissions,
}: {
  readonly automationId: string;
  readonly workflowHash: string;
  readonly selectedNodeId?: string | null;
  readonly readOnly: boolean;
  readonly lockStatus: string;
  readonly permissions: CanvasPermissions;
}) {
  const proposePatch = useCanvasAiPatchProposal(automationId);
  const explain = useCanvasAiExplain(automationId);
  const testPlan = useCanvasAiTestPlan(automationId);
  const applyPatch = useCanvasAiPatchApply(automationId);
  const rejectPatch = useCanvasAiPatchReject(automationId);
  const [message, setMessage] = React.useState("");
  const [response, setResponse] = React.useState<CanvasAiMessageResponse | null>(
    null,
  );
  const proposal =
    response?.status === "patch_proposal" ? response.proposal : null;
  const pending =
    proposePatch.isPending ||
    explain.isPending ||
    testPlan.isPending ||
    applyPatch.isPending ||
    rejectPatch.isPending;
  const applyDisabled =
    !proposal ||
    proposal.status !== "ready_for_review" ||
    readOnly ||
    lockStatus !== "locked_by_me" ||
    !permissions.can_ai_apply_patch ||
    applyPatch.isPending;

  async function submit() {
    const result = await proposePatch.mutateAsync({
      mode: "edit",
      message: message.trim() || "Propose a safe Canvas improvement.",
      base_workflow_hash: workflowHash,
      selected_node_id: selectedNodeId ?? null,
    });
    setResponse(result);
  }

  async function explainCanvas() {
    const result = await explain.mutateAsync({
      base_workflow_hash: workflowHash,
      selected_node_id: selectedNodeId ?? null,
    });
    setResponse(result);
  }

  async function planTests() {
    const result = await testPlan.mutateAsync({
      base_workflow_hash: workflowHash,
      selected_node_id: selectedNodeId ?? null,
    });
    setResponse(result);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void explainCanvas()}
          disabled={pending || !permissions.can_ai_explain}
        >
          <Sparkles aria-hidden data-icon="inline-start" />
          Explain
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void planTests()}
          disabled={pending}
        >
          <Check aria-hidden data-icon="inline-start" />
          Test plan
        </Button>
      </div>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask AI to add, configure, or fix Canvas steps..."
        className="min-h-28"
      />
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={pending || !permissions.can_ai_propose_patch}
      >
        <Send aria-hidden data-icon="inline-start" />
        Propose patch
      </Button>
      {pending ? <AiStatus label="thinking" /> : null}
      {response ? <CanvasAiResponseView response={response} /> : null}
      {proposal ? (
        <PatchProposalCard
          proposal={proposal}
          applyDisabled={applyDisabled}
          onApply={() =>
            applyPatch
              .mutateAsync({
                patch_id: proposal.id,
                base_workflow_hash: proposal.base_workflow_hash,
                user_confirmation: true,
              })
              .then(() => {
                setResponse({
                  status: "debug_explanation",
                  session_id: proposal.session_id,
                  message_id: proposal.id,
                  summary: "Patch applied through CanvasOperationService.",
                  suspected_causes: [],
                  next_actions: [],
                  redacted: true,
                });
              })
          }
          onReject={() =>
            rejectPatch
              .mutateAsync({ patchId: proposal.id })
              .then(() =>
                setResponse({
                  status: "debug_explanation",
                  session_id: proposal.session_id,
                  message_id: proposal.id,
                  summary: "Patch rejected without changing the draft.",
                  suspected_causes: [],
                  next_actions: [],
                  redacted: true,
                }),
              )
          }
        />
      ) : null}
    </div>
  );
}

export function CanvasChatDrawerContent(props: Parameters<typeof CanvasAiDrawer>[0]) {
  return <CanvasAiDrawer {...props} />;
}

export function RunPreviewDrawerContent({
  workflow,
}: {
  readonly workflow: LexFrameWorkflowV2;
}) {
  return (
    <div className="space-y-3">
      <StatusLine label="Can test" value={String(workflow.validation.can_test)} />
      <StatusLine
        label="Can compile"
        value={String(workflow.validation.can_compile)}
      />
      <StatusLine label="Runtime" value={workflow.runtime_projection.status} />
      <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm leading-6 text-[color:var(--muted)]">
        Dry-run and step testing stay draft-only and do not trigger production
        delivery.
      </div>
    </div>
  );
}

export function VersionHistoryDrawerContent({
  automationId,
  versions,
  versionState,
  isLoading,
}: {
  readonly automationId: string;
  readonly versions: CanvasVersionsResponse | undefined;
  readonly versionState?: CanvasVersionStateResponse | null;
  readonly isLoading: boolean;
}) {
  const restoreVersion = useCanvasVersionRestore(automationId);
  const compareVersions = useCanvasVersionCompare(automationId);
  const rollback = useCanvasRollback(automationId);
  const runtimeProjection = useCanvasRuntimeProjection(automationId);
  const exportVersion = useCanvasVersionExport(automationId);
  const [compare, setCompare] = React.useState<CanvasVersionCompareResponse | null>(
    null,
  );
  const [projection, setProjection] =
    React.useState<CanvasRuntimeProjectionVersion | null>(null);
  const [exportedVersion, setExportedVersion] =
    React.useState<CanvasVersionExportResponse | null>(null);
  const [rollbackTarget, setRollbackTarget] =
    React.useState<CanvasVersionSummary | null>(null);
  const [emergencyOpen, setEmergencyOpen] = React.useState(false);
  const activeVersionId =
    versionState?.active_published_version?.id ?? versions?.active_version_id ?? null;

  if (isLoading) {
    return <div className="text-sm text-[color:var(--muted)]">Loading versions...</div>;
  }
  if (!versions || versions.versions.length === 0) {
    return (
      <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-4 text-sm text-[color:var(--muted)]">
        Version history is not available yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!versionState?.permissions.can_emergency_disable}
          onClick={() => setEmergencyOpen(true)}
        >
          <ShieldAlert aria-hidden data-icon="inline-start" />
          Emergency disable
        </Button>
      </div>
      {versions.versions.map((version) => (
        <div
          key={version.id}
          className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{version.title}</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                rev {version.revision_counter} / {version.workflow_hash.slice(0, 8)}
              </div>
            </div>
            <Badge variant={version.is_current ? "accent" : "muted"}>
              {version.status}
            </Badge>
          </div>
          <div className="mt-2 text-xs text-[color:var(--muted)]">
            Validation: {version.validation_status}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                !activeVersionId ||
                activeVersionId === version.id ||
                compareVersions.isPending ||
                !versionState?.permissions.can_compare_versions
              }
              onClick={() =>
                void compareVersions
                  .mutateAsync({ from: activeVersionId!, to: version.id })
                  .then(setCompare)
              }
            >
              <GitCompare aria-hidden data-icon="inline-start" />
              Compare
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                restoreVersion.isPending ||
                !versionState?.permissions.can_restore_version_as_draft
              }
              onClick={() => void restoreVersion.mutateAsync(version.id)}
            >
              <RotateCcw aria-hidden data-icon="inline-start" />
              Restore draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                version.entry_type !== "published_version" ||
                version.is_active ||
                !versionState?.permissions.can_rollback_version
              }
              onClick={() => setRollbackTarget(version)}
            >
              <RotateCcw aria-hidden data-icon="inline-start" />
              Rollback
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                !version.runtime_projection_id ||
                runtimeProjection.isPending ||
                !versionState?.permissions.can_view_runtime_projection
              }
              onClick={() =>
                void runtimeProjection.mutateAsync(version.id).then(setProjection)
              }
            >
              <Eye aria-hidden data-icon="inline-start" />
              Projection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                exportVersion.isPending ||
                !versionState?.permissions.can_download_version_json
              }
              onClick={() => void exportVersion.mutateAsync(version.id).then(setExportedVersion)}
            >
              <Download aria-hidden data-icon="inline-start" />
              Export
            </Button>
          </div>
        </div>
      ))}
      {compare ? <CompareView compare={compare} /> : null}
      {projection ? <RuntimeProjectionPanel projection={projection} /> : null}
      {exportedVersion ? <VersionExportPanel exportedVersion={exportedVersion} /> : null}
      <RollbackModal
        automationId={automationId}
        targetVersion={rollbackTarget}
        activeVersionId={activeVersionId}
        pending={rollback.isPending}
        onClose={() => setRollbackTarget(null)}
        onRollback={(input) =>
          rollback.mutateAsync(input).then(() => setRollbackTarget(null))
        }
      />
      <EmergencyDisableDialog
        automationId={automationId}
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
      />
    </div>
  );
}

export function PublishModal({
  automationId,
  open,
  onClose,
  draftHash,
  revision,
  permissions,
}: {
  readonly automationId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly draftHash: string;
  readonly revision: number;
  readonly permissions: CanvasPermissions;
}) {
  const validatePublish = useCanvasPublishValidate(automationId);
  const publish = useCanvasPublish(automationId);
  const [versionName, setVersionName] = React.useState("");
  const [versionDescription, setVersionDescription] = React.useState("");
  const [syncRuntime, setSyncRuntime] = React.useState(true);
  const [confirmation, setConfirmation] = React.useState("");
  const report = validatePublish.data?.report ?? null;
  const pending = validatePublish.isPending || publish.isPending;
  const canPublish =
    permissions.can_publish &&
    report?.can_publish === true &&
    confirmation.trim().toLowerCase() === "publish";

  if (!open) {
    return null;
  }

  const publishInput = {
    version_name: versionName.trim() || undefined,
    version_description: versionDescription.trim() || undefined,
    sync_runtime: syncRuntime,
    expected_revision: revision,
    idempotency_key: createIdempotencyKey("canvas_publish", draftHash),
    typed_confirmation: confirmation,
  };

  function closePublish() {
    setConfirmation("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[8px] border border-[color:var(--line)] bg-[#0d1118] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="accent">Publish</Badge>
            <h2 className="mt-3 text-xl font-semibold">Publish Canvas version</h2>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={closePublish}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-[color:var(--muted)]">Version name</span>
            <input
              className="h-10 w-full rounded-[8px] border border-[color:var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[color:var(--accent)]"
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              placeholder="vNext production"
            />
          </label>
          <label className="flex items-center gap-3 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm">
            <input
              type="checkbox"
              checked={syncRuntime}
              onChange={(event) => setSyncRuntime(event.target.checked)}
            />
            Sync runtime after publish
          </label>
        </div>
        <label className="mt-3 block space-y-2 text-sm">
          <span className="text-[color:var(--muted)]">Description</span>
          <Textarea
            value={versionDescription}
            onChange={(event) => setVersionDescription(event.target.value)}
            placeholder="What changed in this release?"
            className="min-h-24"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending || !permissions.can_validate_publish}
            onClick={() =>
              void validatePublish.mutateAsync({
                ...publishInput,
                typed_confirmation: undefined,
              })
            }
          >
            <Check aria-hidden data-icon="inline-start" />
            Validate
          </Button>
        </div>
        {validatePublish.error instanceof Error ? (
          <ErrorPanel message={validatePublish.error.message} />
        ) : null}
        {report ? <PublishReportView report={report} /> : null}
        <div className="mt-4 rounded-[8px] border border-[color:var(--line)] bg-black/20 p-3">
          <label className="space-y-2 text-sm">
            <span className="text-[color:var(--muted)]">
              Type &quot;publish&quot; to confirm immutable version creation.
            </span>
            <input
              className="h-10 w-full rounded-[8px] border border-[color:var(--line)] bg-black/20 px-3 text-sm outline-none focus:border-[color:var(--accent)]"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <Button
            type="button"
            className="mt-3"
            disabled={!canPublish || pending}
            onClick={() => void publish.mutateAsync(publishInput).then(closePublish)}
          >
            Publish immutable version
          </Button>
        </div>
      </section>
    </div>
  );
}

function PublishReportView({ report }: { readonly report: CanvasPublishReport }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 text-xs md:grid-cols-4">
        <StatusLine label="Nodes" value={String(report.graph_summary.nodes)} />
        <StatusLine label="Edges" value={String(report.graph_summary.edges)} />
        <StatusLine
          label="Connections"
          value={String(report.required_connections.length)}
        />
        <StatusLine label="Pieces" value={String(report.required_pieces.length)} />
      </div>
      {report.blockers.length > 0 ? (
        <IssueList title="Blockers" tone="danger" issues={report.blockers} />
      ) : (
        <InfoPanel>Publish gate has no blockers.</InfoPanel>
      )}
      {report.warnings.length > 0 ? (
        <IssueList title="Warnings" tone="muted" issues={report.warnings} />
      ) : null}
    </div>
  );
}

function IssueList({
  title,
  tone,
  issues,
}: {
  readonly title: string;
  readonly tone: "danger" | "muted";
  readonly issues: CanvasPublishReport["blockers"];
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
      <Badge variant={tone}>{title}</Badge>
      <div className="mt-3 space-y-2 text-sm">
        {issues.map((issue) => (
          <div key={`${issue.code}:${issue.affected_node_id ?? "workflow"}`}>
            <div className="font-medium">{issue.title}</div>
            <div className="text-xs text-[color:var(--muted)]">{issue.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareView({
  compare,
}: {
  readonly compare: CanvasVersionCompareResponse;
}) {
  return (
    <InfoPanel>
      <div className="font-medium">Compare summary</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <StatusLine label="Added" value={String(compare.summary.added_nodes)} />
        <StatusLine label="Removed" value={String(compare.summary.removed_nodes)} />
        <StatusLine label="Changed" value={String(compare.summary.changed_nodes)} />
      </div>
      <div className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
        {compare.human_summary.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </InfoPanel>
  );
}

function RuntimeProjectionPanel({
  projection,
}: {
  readonly projection: CanvasRuntimeProjectionVersion;
}) {
  return (
    <InfoPanel>
      <div className="font-medium">Runtime projection</div>
      <div className="mt-2 text-xs text-[color:var(--muted)]">
        {projection.provider} / {projection.projection_hash.slice(0, 12)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <StatusLine
          label="Pieces"
          value={String(projection.required_pieces.length)}
        />
        <StatusLine
          label="Connections"
          value={String(projection.required_connections.length)}
        />
      </div>
    </InfoPanel>
  );
}

function VersionExportPanel({
  exportedVersion,
}: {
  readonly exportedVersion: CanvasVersionExportResponse;
}) {
  return (
    <InfoPanel>
      <div className="font-medium">Export ready</div>
      <div className="mt-2 text-xs text-[color:var(--muted)]">
        {exportedVersion.version_id} / {exportedVersion.workflow_hash.slice(0, 12)}
      </div>
      <div className="mt-2 text-xs text-[color:var(--muted)]">
        Redaction: {String(exportedVersion.audit_metadata.redacted)}
      </div>
    </InfoPanel>
  );
}

function RollbackModal({
  targetVersion,
  activeVersionId,
  pending,
  onClose,
  onRollback,
}: {
  readonly automationId: string;
  readonly targetVersion: CanvasVersionSummary | null;
  readonly activeVersionId: string | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onRollback: (input: {
    readonly rollback_type: CanvasRollbackType;
    readonly target_version_id: string;
    readonly reason: string;
    readonly confirm_impact: boolean;
    readonly expected_active_version_id: string | null;
    readonly idempotency_key: string;
    readonly impact_policy: "keep_queued";
  }) => Promise<unknown>;
}) {
  const [reason, setReason] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);

  if (!targetVersion) {
    return null;
  }

  function close() {
    setReason("");
    setConfirmed(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <section className="w-full max-w-xl rounded-[8px] border border-[color:var(--line)] bg-[#0d1118] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="danger">Rollback</Badge>
            <h2 className="mt-3 text-lg font-semibold">
              Switch production to {targetVersion.title}
            </h2>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            <X aria-hidden />
          </Button>
        </div>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for rollback"
          className="mt-4 min-h-24"
        />
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Impact reviewed; queued runs keep their existing snapshots.
        </label>
        <Button
          type="button"
          className="mt-4"
          disabled={pending || !confirmed || reason.trim().length < 6}
          onClick={() =>
            void onRollback({
              rollback_type: "publish_previous_version",
              target_version_id: targetVersion.id,
              reason: reason.trim(),
              confirm_impact: confirmed,
              expected_active_version_id: activeVersionId,
              idempotency_key: createIdempotencyKey("canvas_rollback", targetVersion.id),
              impact_policy: "keep_queued",
            }).then(close)
          }
        >
          Roll back production
        </Button>
      </section>
    </div>
  );
}

function EmergencyDisableDialog({
  automationId,
  open,
  onClose,
}: {
  readonly automationId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const emergencyDisable = useCanvasEmergencyDisable(automationId);
  const [reason, setReason] = React.useState("");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <section className="w-full max-w-xl rounded-[8px] border border-[color:var(--line)] bg-[#0d1118] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="danger">Emergency disable</Badge>
            <h2 className="mt-3 text-lg font-semibold">Block new production runs</h2>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for production disable"
          className="mt-4 min-h-24"
        />
        <Button
          type="button"
          className="mt-4"
          disabled={emergencyDisable.isPending || reason.trim().length < 6}
          onClick={() =>
            void emergencyDisable
              .mutateAsync({
                reason: reason.trim(),
                idempotency_key: createIdempotencyKey(
                  "canvas_emergency_disable",
                  automationId,
                ),
              })
              .then(onClose)
          }
        >
          Disable production
        </Button>
      </section>
    </div>
  );
}

function ErrorPanel({ message }: { readonly message: string }) {
  return (
    <div className="mt-4 rounded-[8px] border border-red-500/40 bg-red-950/30 p-3 text-sm">
      <AlertTriangle aria-hidden data-icon="inline-start" />
      {message}
    </div>
  );
}

function createIdempotencyKey(prefix: string, seed: string) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}:${window.crypto.randomUUID()}`;
  }
  return `${prefix}:${seed}:${Date.now()}`;
}

function CanvasAiResponseView({
  response,
}: {
  readonly response: CanvasAiMessageResponse;
}) {
  if (response.status === "explanation") {
    return <InfoPanel>{response.summary}</InfoPanel>;
  }
  if (response.status === "needs_clarification") {
    return (
      <InfoPanel>
        {response.questions.map((question) => (
          <div key={question.id}>{question.label}</div>
        ))}
      </InfoPanel>
    );
  }
  if (response.status === "policy_blocked") {
    return (
      <div className="rounded-[8px] border border-red-500/40 bg-red-950/30 p-3 text-sm">
        <AlertTriangle aria-hidden data-icon="inline-start" />
        {response.message}
      </div>
    );
  }
  if (response.status === "test_plan") {
    return (
      <InfoPanel>
        <div className="font-medium">Draft test plan</div>
        <div className="mt-2 text-[color:var(--muted)]">
          {response.plan.dry_run_order.length} steps, production_safe=
          {String(response.plan.production_safe)}
        </div>
      </InfoPanel>
    );
  }
  if (response.status === "debug_explanation") {
    return <InfoPanel>{response.summary}</InfoPanel>;
  }
  return null;
}

function PatchProposalCard({
  proposal,
  applyDisabled,
  onApply,
  onReject,
}: {
  readonly proposal: CanvasAiPatchProposal;
  readonly applyDisabled: boolean;
  readonly onApply: () => Promise<void>;
  readonly onReject: () => Promise<void>;
}) {
  return (
    <div className="space-y-3 rounded-[8px] border border-[color:var(--line)] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitPullRequest aria-hidden className="size-4" />
            {proposal.title}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {proposal.status} / {proposal.operations.length} operation(s)
          </div>
        </div>
        <Badge variant={proposal.status === "ready_for_review" ? "accent" : "muted"}>
          {proposal.status}
        </Badge>
      </div>
      <div className="text-sm leading-6 text-[color:var(--muted)]">
        {proposal.assistant_summary}
      </div>
      <CanvasAiDiffPanel proposal={proposal} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void onApply()}
          disabled={applyDisabled}
        >
          Apply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void onReject()}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

function CanvasAiDiffPanel({
  proposal,
}: {
  readonly proposal: CanvasAiPatchProposal;
}) {
  const lines = [
    ["added nodes", proposal.diff.added_nodes.length],
    ["changed nodes", proposal.diff.changed_nodes.length],
    ["removed nodes", proposal.diff.removed_nodes.length],
    ["bindings", proposal.diff.binding_changes.length],
    ["policy blocks", proposal.diff.policy_blocks.length],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {lines.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[6px] border border-[color:var(--line)] bg-white/4 p-2"
        >
          <div className="text-[color:var(--muted)]">{label}</div>
          <div className="mt-1 font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function InfoPanel({ children }: { readonly children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm leading-6">
      {children}
    </div>
  );
}

function AiStatus({ label }: { readonly label: string }) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm text-[color:var(--muted)]">
      {label}
    </div>
  );
}

function StatusLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm">
      <span className="text-[color:var(--muted)]">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
