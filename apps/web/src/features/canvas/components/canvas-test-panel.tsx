"use client";

import type {
  CanvasPermissions,
  CanvasTestMode,
  CanvasTestRunRequest,
  CanvasTestRunResponse,
  LexFrameWorkflowV2,
} from "@lexframe/contracts";
import {
  AlertTriangle,
  Bug,
  FileText,
  Loader2,
  Play,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCanvasAiTestPlan,
  useCanvasTestRun,
  useCanvasTestSupportBundle,
} from "../hooks/use-canvas-data";

type Endpoint =
  | "validate"
  | "test-step"
  | "test-until-step"
  | "test-branch"
  | "test-loop"
  | "dry-run";

const modes: readonly {
  readonly mode: CanvasTestMode;
  readonly endpoint: Endpoint;
  readonly label: string;
  readonly needsTarget: boolean;
}[] = [
  {
    mode: "validation_only",
    endpoint: "validate",
    label: "Validate",
    needsTarget: false,
  },
  {
    mode: "test_selected_step",
    endpoint: "test-step",
    label: "Step",
    needsTarget: true,
  },
  {
    mode: "test_until_selected_step",
    endpoint: "test-until-step",
    label: "Until step",
    needsTarget: true,
  },
  {
    mode: "test_branch",
    endpoint: "test-branch",
    label: "Branch",
    needsTarget: true,
  },
  {
    mode: "test_loop_sample",
    endpoint: "test-loop",
    label: "Loop",
    needsTarget: true,
  },
  {
    mode: "dry_run_full",
    endpoint: "dry-run",
    label: "Dry-run",
    needsTarget: false,
  },
];

const defaultModeConfig = modes[0]!;

export function CanvasTestPanel({
  automationId,
  workflow,
  permissions,
  selectedNodeId,
}: {
  readonly automationId: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly permissions: CanvasPermissions;
  readonly selectedNodeId: string | null;
}) {
  const [selectedMode, setSelectedMode] =
    React.useState<CanvasTestMode>("validation_only");
  const [latestRun, setLatestRun] = React.useState<CanvasTestRunResponse | null>(
    null,
  );
  const testRun = useCanvasTestRun(automationId);
  const aiTestPlan = useCanvasAiTestPlan(automationId);
  const supportBundle = useCanvasTestSupportBundle({
    automationId,
    testRunId: latestRun?.test_run_id,
  });
  const modeConfig =
    modes.find((item) => item.mode === selectedMode) ?? defaultModeConfig;
  const targetRequired = modeConfig.needsTarget;
  const canRun = permissions.can_test && (!targetRequired || Boolean(selectedNodeId));

  function runTest() {
    if (!canRun) {
      return;
    }
    const request = buildRequest({
      workflow,
      mode: modeConfig.mode,
      targetNodeId: targetRequired ? selectedNodeId : null,
    });
    testRun.mutate(
      {
        endpoint: modeConfig.endpoint,
        request,
      },
      {
        onSuccess: setLatestRun,
      },
    );
  }

  return (
    <section className="border-b border-[color:var(--line)] bg-[#0d131c] px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="accent">Test lab</Badge>
          <CanvasTestModeSelector
            selectedMode={selectedMode}
            onChange={setSelectedMode}
          />
          {targetRequired ? (
            <span className="text-xs text-[color:var(--muted)]">
              Target: {selectedNodeId ?? "select a step"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CanvasTestRunButton
            disabled={!canRun || testRun.isPending}
            pending={testRun.isPending}
            onRun={runTest}
          />
          <CanvasSupportBundleButton
            disabled={!latestRun || supportBundle.isPending}
            pending={supportBundle.isPending}
            onGenerate={() => supportBundle.mutate()}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={aiTestPlan.isPending}
            onClick={() =>
              aiTestPlan.mutate({
                selected_node_id: selectedNodeId,
              })
            }
          >
            <Sparkles aria-hidden data-icon="inline-start" />
            AI plan
          </Button>
        </div>
      </div>
      <CanvasTestResult run={latestRun ?? testRun.data ?? null} />
      {testRun.isError ? (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-3 text-sm text-[color:var(--danger)]">
          <AlertTriangle aria-hidden className="mt-0.5 size-4" />
          <span>
            {testRun.error instanceof Error
              ? testRun.error.message
              : "Canvas test failed."}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function CanvasTestModeSelector({
  selectedMode,
  onChange,
}: {
  readonly selectedMode: CanvasTestMode;
  readonly onChange: (mode: CanvasTestMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-[color:var(--line)] bg-black/20 p-1">
      {modes.map((item) => (
        <button
          key={item.mode}
          type="button"
          className={[
            "h-7 rounded-full px-3 text-xs transition-colors",
            selectedMode === item.mode
              ? "bg-[color:var(--accent)] text-[#101319]"
              : "text-[color:var(--muted)] hover:bg-white/8 hover:text-[color:var(--foreground)]",
          ].join(" ")}
          onClick={() => onChange(item.mode)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CanvasTestRunButton({
  disabled,
  pending,
  onRun,
}: {
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onRun: () => void;
}) {
  return (
    <Button type="button" size="sm" disabled={disabled} onClick={onRun}>
      {pending ? <Loader2 aria-hidden /> : <Play aria-hidden />}
      Run
    </Button>
  );
}

function CanvasSupportBundleButton({
  disabled,
  pending,
  onGenerate,
}: {
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onGenerate: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={onGenerate}
    >
      {pending ? <Loader2 aria-hidden /> : <FileText aria-hidden />}
      Support bundle
    </Button>
  );
}

function CanvasTestResult({
  run,
}: {
  readonly run: CanvasTestRunResponse | null;
}) {
  if (!run) {
    return null;
  }
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={badgeForStatus(run.status)}>{run.status}</Badge>
          <span className="truncate text-xs text-[color:var(--muted)]">
            {run.trace_id}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Metric label="ok" value={run.summary.succeeded_steps} />
          <Metric label="sim" value={run.summary.simulated_steps} />
          <Metric label="blocked" value={run.summary.blocked_steps} />
        </div>
      </div>
      <div className="min-w-0 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
        <CanvasDryRunPolicyNotice />
        <CanvasTestProgressTimeline run={run} />
        <CanvasDebugErrorPanel run={run} />
      </div>
    </div>
  );
}

function CanvasDryRunPolicyNotice() {
  return (
    <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
      <ShieldCheck aria-hidden className="size-4" />
      <span>External actions are previewed or blocked in dry-run.</span>
    </div>
  );
}

function CanvasTestProgressTimeline({
  run,
}: {
  readonly run: CanvasTestRunResponse;
}) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {run.steps.length === 0 ? (
        <StatusPill label="validation only" status={run.status} />
      ) : (
        run.steps.map((step) => (
          <StatusPill
            key={step.node_id}
            label={step.display_name}
            status={step.status}
            error={step.error?.user_message}
          />
        ))
      )}
    </div>
  );
}

function CanvasDebugErrorPanel({
  run,
}: {
  readonly run: CanvasTestRunResponse;
}) {
  if (!run.steps.some((step) => step.error)) {
    return null;
  }
  return (
    <div className="mt-3 space-y-2">
      {run.steps
        .filter((step) => step.error)
        .slice(0, 3)
        .map((step) => (
          <div
            key={step.node_id}
            className="rounded-[8px] border border-[color:var(--danger)]/30 bg-black/20 p-2 text-xs"
          >
            <div className="flex items-center gap-2 font-medium text-[color:var(--danger)]">
              <Bug aria-hidden className="size-3.5" />
              {step.error?.code}
            </div>
            <p className="mt-1 text-[color:var(--muted)]">
              {step.error?.user_message}
            </p>
          </div>
        ))}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-black/20 p-2">
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="text-[color:var(--muted)]">{label}</div>
    </div>
  );
}

function StatusPill({
  label,
  status,
  error,
}: {
  readonly label: string;
  readonly status: string;
  readonly error?: string;
}) {
  return (
    <div
      className="min-w-[150px] rounded-[8px] border border-[color:var(--line)] bg-black/20 p-2"
      title={error ?? label}
    >
      <Badge variant={badgeForStatus(status)}>{status}</Badge>
      <div className="mt-2 truncate text-xs">{label}</div>
    </div>
  );
}

function buildRequest(input: {
  readonly workflow: LexFrameWorkflowV2;
  readonly mode: CanvasTestMode;
  readonly targetNodeId: string | null;
}): CanvasTestRunRequest {
  return {
    draft_version_id: input.workflow.draft_version_id,
    mode: input.mode,
    target_node_id: input.targetNodeId,
    target_branch_id: null,
    input_mode: input.targetNodeId ? "use_current_bindings" : "schema_generated",
    policy: {
      allow_real_reads: true,
      allow_real_writes: false,
      allow_external_calls: false,
      allow_ai_calls: false,
      ai_mode: "mock",
      max_loop_items: 5,
      timeout_seconds: 30,
    },
    redaction: {
      raw_input_visible: false,
      raw_output_visible: false,
      store_raw_payload: false,
    },
  };
}

function badgeForStatus(status: string) {
  if (status === "succeeded" || status === "valid") {
    return "success" as const;
  }
  if (
    status === "failed" ||
    status === "blocked_by_policy" ||
    status === "invalid"
  ) {
    return "danger" as const;
  }
  if (status === "simulated" || status === "running") {
    return "accent" as const;
  }
  return "muted" as const;
}
