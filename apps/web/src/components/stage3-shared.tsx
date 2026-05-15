"use client";

import type { TemplateRequirement } from "@lexframe/contracts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStatus, t } from "@/lib/i18n";

export function QueryState({
  title,
  description,
  testId,
}: {
  readonly title: string;
  readonly description: string;
  readonly testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <Badge variant="muted">state</Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function RequirementPanel({
  requirements,
}: {
  readonly requirements: readonly TemplateRequirement[];
}) {
  if (requirements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="success">requirements</Badge>
          <CardTitle>No blocking requirements</CardTitle>
          <CardDescription>
            Current version does not require extra documents, profiles or approvals.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="accent">requirements</Badge>
        <CardTitle>Readiness inputs</CardTitle>
        <CardDescription>
          Backend issues these statuses and frontend only renders them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {requirements.map((requirement) => (
          <div
            key={requirement.code}
            className="rounded-[var(--lf-radius-card)] border border-[color:var(--line)] bg-[color:var(--lf-bg-muted)] p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{requirement.kind}</Badge>
              <Badge variant={badgeVariantForStatus(requirement.status)}>
              {formatStatus(requirement.status)}
              </Badge>
              {requirement.optional ? <Badge variant="muted">optional</Badge> : null}
            </div>
            <div className="mt-3 text-base font-medium">{t(requirement.label)}</div>
            <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {t(requirement.description)}
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {requirement.code}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function JsonPreview({
  title,
  description,
  value,
}: {
  readonly title: string;
  readonly description: string;
  readonly value: unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="muted">json</Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-[var(--lf-radius-card)] border border-[color:var(--line)] bg-[color:var(--lf-bg-muted)] p-5 text-sm leading-6 text-[color:var(--muted-strong)]">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function badgeVariantForStatus(status: string) {
  if (
    status === "ready" ||
    status === "valid" ||
    status === "approved" ||
    status === "published" ||
    status === "compatible" ||
    status === "synced" ||
    status === "low" ||
    status === "healthy" ||
    status === "success" ||
    status === "completed"
  ) {
    return "success" as const;
  }

  if (
    status === "blocked" ||
    status === "rejected" ||
    status === "policy_blocked" ||
    status === "failed" ||
    status === "high" ||
    status === "error"
  ) {
    return "danger" as const;
  }

  if (
    status === "running" ||
    status === "starting" ||
    status === "waiting_approval" ||
    status === "waiting_delivery_approval" ||
    status === "delivering" ||
    status === "pending" ||
    status === "warning" ||
    status === "degraded"
  ) {
    return "accent" as const;
  }

  return "muted" as const;
}

export function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
