"use client";

import type {
  CanvasAccessDecision,
  CanvasSecurityPolicy,
} from "@lexframe/contracts";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CanvasPermissionGate({
  decision,
  children,
  fallback,
}: {
  readonly decision?: CanvasAccessDecision | null;
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}) {
  if (!decision || decision.allowed) {
    return <>{children}</>;
  }
  return (
    <>
      {fallback ?? (
        <PolicyBlockBanner
          title="Action unavailable"
          reason={decision.message ?? decision.reason_code}
        />
      )}
    </>
  );
}

export function SecurityPolicyBadge({
  policy,
}: {
  readonly policy: CanvasSecurityPolicy;
}) {
  return (
    <Badge variant={policy.severity === "critical" ? "danger" : "accent"}>
      <ShieldCheck aria-hidden className="mr-1 size-3" />
      {policy.code}
    </Badge>
  );
}

export function RawDataAccessDialog({
  open,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <SecurityDialog
      title="Raw data access"
      icon={<LockKeyhole aria-hidden className="size-4" />}
      primaryLabel="Continue"
      onPrimary={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function ReauthRequiredDialog({
  open,
  onReauth,
  onCancel,
}: {
  readonly open: boolean;
  readonly onReauth: () => void;
  readonly onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <SecurityDialog
      title="Reauthentication required"
      icon={<LockKeyhole aria-hidden className="size-4" />}
      primaryLabel="Verify"
      onPrimary={onReauth}
      onCancel={onCancel}
    />
  );
}

export function PolicyBlockBanner({
  title,
  reason,
}: {
  readonly title: string;
  readonly reason: string;
}) {
  return (
    <div className="rounded-[8px] border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle aria-hidden className="size-4" />
        {title}
      </div>
      <p className="mt-1 text-red-100/80">{reason}</p>
    </div>
  );
}

export function AuditReasonDialog({
  open,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly reason: string;
  readonly onReasonChange: (reason: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-[#0f151f] p-4">
      <label className="grid gap-2 text-sm">
        <span className="font-medium text-[color:var(--text)]">Audit reason</span>
        <textarea
          className="min-h-24 rounded-[8px] border border-[color:var(--line)] bg-black/30 p-2"
          value={reason}
          onChange={(event) => onReasonChange(event.currentTarget.value)}
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={!reason.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function RuntimeImportReviewDialog({
  blockedCodes,
}: {
  readonly blockedCodes: readonly string[];
}) {
  if (blockedCodes.length === 0) {
    return null;
  }
  return (
    <PolicyBlockBanner
      title="Runtime import review required"
      reason={blockedCodes.slice(0, 4).join(", ")}
    />
  );
}

export function AdvancedBuilderAccessGate({
  decision,
  children,
}: {
  readonly decision?: CanvasAccessDecision | null;
  readonly children: React.ReactNode;
}) {
  return (
    <CanvasPermissionGate
      decision={decision}
      fallback={
        <PolicyBlockBanner
          title="Advanced Builder locked"
          reason={decision?.message ?? "Access is not available."}
        />
      }
    >
      {children}
    </CanvasPermissionGate>
  );
}

function SecurityDialog({
  title,
  icon,
  primaryLabel,
  onPrimary,
  onCancel,
}: {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly primaryLabel: string;
  readonly onPrimary: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-[#0f151f] p-4">
      <div className="flex items-center gap-2 font-medium text-[color:var(--text)]">
        {icon}
        {title}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onPrimary}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
