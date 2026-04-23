"use client";

import type {
  SecretInventoryItem,
  SecurityAlert,
  SecurityIncident,
  SecuritySessionSummary,
} from "@lexframe/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useAccessReviewCampaigns,
  useActivepiecesSecurityOverview,
  useAdminSecurityOverview,
  useAiProviderPolicies,
  useAuditEventsAdmin,
  useComplianceProcessingActivities,
  useCreateReauthChallenge,
  useCreateSecurityIncident,
  useDsrRequests,
  useRetentionPolicies,
  useRetentionReport,
  useRevokeSecuritySession,
  useSecretsInventory,
  useSecretRotation,
  useSecurityAlerts,
  useSecurityIncidents,
  useSecuritySessions,
  useUpdateSecurityAlert,
  useUpdateSecurityIncident,
  useUpdateWorkspaceSecuritySettings,
  useVerifyReauthChallenge,
  useWorkspaceSecuritySettings,
} from "@/hooks/use-stage11-security";
import { useSecurityAccount } from "@/hooks/use-stage0-data";
import { useSessionBridge } from "@/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const securitySections = [
  { href: "/admin/security", label: "overview" },
  { href: "/admin/security/sessions", label: "sessions" },
  { href: "/admin/security/policies", label: "policies" },
  { href: "/admin/security/secrets", label: "secrets" },
  { href: "/admin/security/audit", label: "audit" },
  { href: "/admin/security/ai", label: "ai" },
  { href: "/admin/security/activepieces", label: "activepieces" },
  { href: "/admin/security/alerts", label: "alerts" },
  { href: "/admin/security/incidents", label: "incidents" },
  { href: "/admin/compliance", label: "compliance" },
  { href: "/admin/access-reviews", label: "access reviews" },
] as const;

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SectionNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-hidden rounded-[30px] border border-[color:var(--line)] bg-[radial-gradient(circle_at_top_left,rgba(221,184,120,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
      <div className="flex flex-wrap gap-2">
        {securitySections.map((section) => {
          const active =
            pathname === section.href ||
            (section.href !== "/admin/security" && pathname.startsWith(section.href));

          return (
            <Link
              key={section.href}
              href={section.href}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--foreground)]"
                  : "border-[color:var(--line)] bg-white/5 text-[color:var(--muted)] hover:border-[color:var(--accent)]/40 hover:text-[color:var(--foreground)]"
              }`}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ReauthCard() {
  const { reauthToken, setReauthToken, clearReauthToken } = useSessionBridge();
  const createChallenge = useCreateReauthChallenge();
  const verifyChallenge = useVerifyReauthChallenge();
  const [reason, setReason] = useState("Stage 11 admin action");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("000000");

  return (
    <Card className="border-[color:var(--line)] bg-white/4">
      <CardHeader>
        <Badge variant={reauthToken ? "success" : "muted"}>reauth</Badge>
        <CardTitle>Admin reauth token</CardTitle>
        <CardDescription>
          High-risk Stage 11 actions require a short-lived backend token in the request headers.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr_auto]">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        <Input
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value)}
          placeholder="one-time code"
        />
        <div className="flex gap-2">
          <Button
            variant="subtle"
            onClick={() => {
              void (async () => {
                const challenge = await createChallenge.mutateAsync({ reason });
                setChallengeId(challenge.id);
              })();
            }}
          >
            Issue challenge
          </Button>
          <Button
            onClick={() => {
              void (async () => {
                if (!challengeId) {
                  return;
                }

                const challenge = await verifyChallenge.mutateAsync({
                  challengeId,
                  verificationCode,
                });
                setReauthToken(challenge.token ?? null);
              })();
            }}
          >
            Verify
          </Button>
          <Button variant="ghost" onClick={() => clearReauthToken()}>
            Clear
          </Button>
        </div>
        <div className="lg:col-span-3 rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted-strong)]">
          <div>Challenge: {challengeId ?? "not issued yet"}</div>
          <div>Token state: {reauthToken ? "active in session provider" : "missing"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Stage11SecurityScaffold({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SectionNav />
      <Card className="overflow-hidden border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(221,184,120,0.11),rgba(255,255,255,0.03)_45%,rgba(0,0,0,0.24))]">
        <CardHeader>
          <Badge variant="accent">security control plane</Badge>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
      <ReauthCard />
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly hint: string;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-white/4 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-none">{value}</div>
      <div className="mt-2 text-sm text-[color:var(--muted)]">{hint}</div>
    </div>
  );
}

export function Stage11OverviewPanel() {
  const overview = useAdminSecurityOverview();
  const account = useSecurityAccount();
  const { sessionContext } = useSessionBridge();

  return (
    <Stage11SecurityScaffold
      title="Security overview and release gates"
      description="Overview keeps the current security posture, release blockers and escalation surfaces visible before drilling down into a single domain."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[color:var(--line)] bg-black/20">
          <CardHeader>
            <Badge variant="accent">session posture</Badge>
            <CardTitle>Workspace boundary and account posture</CardTitle>
            <CardDescription>
              Session risk, MFA expectations and delivery policy are carried directly in `SessionContext.security`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="session risk"
              value={sessionContext.security.sessionRisk}
              hint="Computed from workspace policy and live session state."
            />
            <MetricCard
              label="active sessions"
              value={account.data?.activeSessionCount ?? "n/a"}
              hint="Live count returned by the backend identity module."
            />
            <MetricCard
              label="reauth"
              value={sessionContext.security.adminActionsRequireReauth ? "on" : "off"}
              hint="High-risk admin mutations now go through AdminReauthGuard."
            />
          </CardContent>
        </Card>

        <Card className="border-[color:var(--line)] bg-white/4">
          <CardHeader>
            <Badge variant="muted">release gates</Badge>
            <CardTitle>Current Stage 11 blockers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(overview.data?.releaseGates ?? []).slice(0, 5).map((gate) => (
              <div
                key={gate.gateCode}
                className="rounded-[18px] border border-[color:var(--line)] bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[color:var(--foreground)]">{gate.title}</div>
                  <Badge variant={gate.required ? "danger" : "muted"}>{gate.latestStatus ?? "pending"}</Badge>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {gate.gateCode} • {gate.owner} • {gate.severity}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="open alerts" value={overview.data?.openAlerts ?? 0} hint="Needs acknowledgement or resolution." />
        <MetricCard label="open incidents" value={overview.data?.openIncidents ?? 0} hint="Incident mode can hard-stop risky delivery paths." />
        <MetricCard label="tracked secrets" value={overview.data?.secrets.length ?? 0} hint="Inventory is backend-only and rotation-aware." />
        <MetricCard label="critical alerts" value={overview.data?.criticalAlerts.length ?? 0} hint="Escalation queue for security admins." />
      </div>
    </Stage11SecurityScaffold>
  );
}

function SessionRow({ session }: { readonly session: SecuritySessionSummary }) {
  const revoke = useRevokeSecuritySession(session.id);

  return (
    <div className="grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_auto]">
      <div>
        <div className="text-sm text-[color:var(--foreground)]">{session.deviceLabel ?? session.id}</div>
        <div className="mt-1 text-xs text-[color:var(--muted)]">
          {session.authProvider ?? "unknown provider"} • last seen {formatTimestamp(session.lastSeenAt)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={session.riskLevel === "high" ? "danger" : session.riskLevel === "medium" ? "accent" : "muted"}>
          {session.riskLevel}
        </Badge>
        <Badge variant={session.revokedAt ? "danger" : "success"}>
          {session.revokedAt ? "revoked" : "active"}
        </Badge>
      </div>
      <div className="text-sm text-[color:var(--muted-strong)]">
        Created {formatTimestamp(session.createdAt)}
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          disabled={Boolean(session.revokedAt)}
          onClick={() => {
            void revoke.mutateAsync({ reason: "Security console revocation" });
          }}
        >
          Revoke
        </Button>
      </div>
    </div>
  );
}

export function Stage11SessionsPanel() {
  const sessions = useSecuritySessions();

  return (
    <Stage11SecurityScaffold
      title="Session inventory and revocation"
      description="Foundation wave: track each user session, attach risk context and revoke compromised or stale sessions under explicit reauth."
    >
      <div className="grid gap-3">
        {(sessions.data ?? []).map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11PoliciesPanel() {
  const settings = useWorkspaceSecuritySettings();
  const updateSettings = useUpdateWorkspaceSecuritySettings();

  const policyDraft = useMemo(
    () => ({
      requireMfaForAdmins: settings.data?.requireMfaForAdmins ?? true,
      ssoRequired: settings.data?.ssoRequired ?? false,
      aiSensitiveDataAllowed: settings.data?.aiSensitiveDataAllowed ?? false,
      externalDeliveryRequiresApproval:
        settings.data?.externalDeliveryRequiresApproval ?? true,
    }),
    [settings.data],
  );

  return (
    <Stage11SecurityScaffold
      title="Workspace security policies"
      description="Policy state covers MFA, SSO, AI sensitivity and external delivery boundaries for the active workspace."
    >
      <Card className="border-[color:var(--line)] bg-white/4">
        <CardHeader>
          <Badge variant="muted">workspace policy</Badge>
          <CardTitle>Current guardrails</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="admin MFA" value={policyDraft.requireMfaForAdmins ? "required" : "optional"} hint="Raised from workspace policy row." />
          <MetricCard label="SSO" value={policyDraft.ssoRequired ? "required" : "optional"} hint="Used by SessionContext.security and admin workflows." />
          <MetricCard label="AI sensitive data" value={policyDraft.aiSensitiveDataAllowed ? "allowed" : "blocked"} hint="Workspace-level policy before provider routing." />
          <MetricCard label="external delivery" value={policyDraft.externalDeliveryRequiresApproval ? "approval" : "direct"} hint="Incident mode can still override this path." />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void updateSettings.mutateAsync({
              requireMfaForAdmins: !policyDraft.requireMfaForAdmins,
            });
          }}
        >
          Toggle admin MFA
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            void updateSettings.mutateAsync({
              externalDeliveryRequiresApproval:
                !policyDraft.externalDeliveryRequiresApproval,
            });
          }}
        >
          Toggle external approval
        </Button>
      </div>
    </Stage11SecurityScaffold>
  );
}

function SecretRow({ item }: { readonly item: SecretInventoryItem }) {
  const markCompromised = useSecretRotation(item.secretCode, "compromised");
  const startRotation = useSecretRotation(item.secretCode, "start");
  const completeRotation = useSecretRotation(item.secretCode, "complete");

  return (
    <div className="grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4 lg:grid-cols-[1.1fr_0.8fr_0.8fr_auto]">
      <div>
        <div className="text-sm text-[color:var(--foreground)]">{item.secretCode}</div>
        <div className="mt-1 text-xs text-[color:var(--muted)]">
          {item.provider} • backend only: {item.backendOnly ? "yes" : "no"}
        </div>
      </div>
      <div className="text-sm text-[color:var(--muted-strong)]">
        Last rotation {formatTimestamp(item.lastRotatedAt)}
      </div>
      <div className="flex items-center">
        <Badge variant={item.status === "configured" ? "success" : item.status === "missing" ? "muted" : "danger"}>
          {item.status}
        </Badge>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => void startRotation.mutateAsync({ notes: "Stage 11 rotation start" })}>
          Start
        </Button>
        <Button variant="ghost" onClick={() => void completeRotation.mutateAsync({ notes: "Stage 11 rotation complete" })}>
          Complete
        </Button>
        <Button variant="ghost" onClick={() => void markCompromised.mutateAsync({ notes: "Marked compromised from console" })}>
          Compromise
        </Button>
      </div>
    </div>
  );
}

export function Stage11SecretsPanel() {
  const secrets = useSecretsInventory();

  return (
    <Stage11SecurityScaffold
      title="Secrets inventory and rotation"
      description="Secret metadata stays visible to security admins without exposing raw values to the client or telemetry."
    >
      <div className="grid gap-3">
        {(secrets.data ?? []).map((item) => (
          <SecretRow key={item.id} item={item} />
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11AuditPanel() {
  const audit = useAuditEventsAdmin();

  return (
    <Stage11SecurityScaffold
      title="Immutable audit trail"
      description="Stage 11 extends the canonical audit stream with category, session and data-class context instead of introducing a second store."
    >
      <div className="grid gap-3">
        {(audit.data ?? []).map((event) => (
          <div
            key={event.id}
            className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--foreground)]">{event.action}</div>
              <div className="flex gap-2">
                <Badge variant="muted">{event.eventCategory ?? "general"}</Badge>
                <Badge variant={event.result === "success" ? "success" : "danger"}>{event.result}</Badge>
              </div>
            </div>
            <div className="mt-2 text-xs text-[color:var(--muted)]">
              session {event.sessionId ?? "n/a"} • data {event.dataClass ?? "n/a"} • {formatTimestamp(event.occurredAt)}
            </div>
          </div>
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11AiPanel() {
  const policies = useAiProviderPolicies();
  const { sessionContext } = useSessionBridge();

  return (
    <Stage11SecurityScaffold
      title="AI routing and provider policy"
      description="Provider routes are explicit about allowed data classes, ZDR requirements and prompt storage posture."
    >
      <Card className="border-[color:var(--line)] bg-black/20">
        <CardHeader>
          <Badge variant="accent">session policy</Badge>
          <CardTitle>Current session AI posture</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <MetricCard label="sensitive data" value={sessionContext.security.aiSensitiveDataPolicy} hint="Returned in SessionContext.security." />
          <MetricCard label="MFA" value={sessionContext.security.mfaRequired ? "required" : "not required"} hint="Session-level hardening input for admin AI controls." />
          <MetricCard label="delivery approval" value={sessionContext.security.externalDeliveryRequiresApproval ? "required" : "not required"} hint="Protects AI-assisted outbound actions." />
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {(policies.data ?? []).map((policy) => (
          <div
            key={policy.id}
            className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-[color:var(--foreground)]">
                  {policy.provider} / {policy.model}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  data classes: {policy.allowedDataClasses.join(", ") || "none"}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant={policy.enabled ? "success" : "muted"}>{policy.enabled ? "enabled" : "disabled"}</Badge>
                <Badge variant={policy.requiresRedaction ? "danger" : "muted"}>
                  {policy.requiresRedaction ? "redact" : "direct"}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11ActivepiecesPanel() {
  const overview = useActivepiecesSecurityOverview();

  return (
    <Stage11SecurityScaffold
      title="Activepieces governance"
      description="Builder access, token TTL and runtime connectivity are surfaced through backend-issued embed tokens instead of browser-managed keys."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="token TTL" value={overview.data?.tokenTtlSeconds ?? 0} hint="Seconds for short-lived embed tokens." />
        <MetricCard label="sandbox" value={overview.data?.sandboxRequired ? "required" : "optional"} hint="Workspace-level governance for builder execution." />
        <MetricCard label="event streaming" value={overview.data?.eventStreamingEnabled ? "on" : "off"} hint="Controls callback streaming posture." />
        <MetricCard label="incident lock" value={overview.data?.incidentLockActive ? "active" : "clear"} hint="Blocks builder issuance while incident mode is active." />
      </div>

      <div className="grid gap-3">
        {(overview.data?.runtimeConnections ?? []).map((connection) => (
          <div
            key={connection.id}
            className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--foreground)]">{connection.displayName}</div>
              <Badge variant={connection.status === "connected" ? "success" : "danger"}>
                {connection.status}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-[color:var(--muted)]">
              {connection.provider} • {connection.scope} • last checked {formatTimestamp(connection.lastCheckedAt)}
            </div>
          </div>
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

function AlertRow({ alert }: { readonly alert: SecurityAlert }) {
  const update = useUpdateSecurityAlert(alert.id);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[color:var(--foreground)]">{alert.title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{alert.description}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant={alert.severity === "critical" || alert.severity === "high" ? "danger" : "muted"}>{alert.severity}</Badge>
          <Badge variant={alert.status === "resolved" ? "success" : "accent"}>{alert.status}</Badge>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={() => void update.mutateAsync({ status: "acknowledged" })}>
          Acknowledge
        </Button>
        <Button variant="ghost" onClick={() => void update.mutateAsync({ status: "resolved" })}>
          Resolve
        </Button>
      </div>
    </div>
  );
}

export function Stage11AlertsPanel() {
  const alerts = useSecurityAlerts();

  return (
    <Stage11SecurityScaffold
      title="Alert queue"
      description="Security admins can acknowledge and resolve alerts under reauth, with changes landing in the canonical audit stream."
    >
      <div className="grid gap-3">
        {(alerts.data ?? []).map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

function IncidentRow({ incident }: { readonly incident: SecurityIncident }) {
  const update = useUpdateSecurityIncident(incident.id);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[color:var(--foreground)]">{incident.title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            assigned {incident.assignedTo ?? "unassigned"} • updated {formatTimestamp(incident.updatedAt)}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={incident.severity === "critical" || incident.severity === "high" ? "danger" : "muted"}>{incident.severity}</Badge>
          <Badge variant={incident.incidentModeEnabled ? "danger" : "muted"}>
            {incident.incidentModeEnabled ? "incident mode" : "normal"}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => void update.mutateAsync({ status: "contained" })}>
          Contain
        </Button>
        <Button variant="ghost" onClick={() => void update.mutateAsync({ status: "resolved" })}>
          Resolve
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void update.mutateAsync({
              incidentModeEnabled: !incident.incidentModeEnabled,
            });
          }}
        >
          Toggle incident mode
        </Button>
      </div>
    </div>
  );
}

export function Stage11IncidentsPanel() {
  const incidents = useSecurityIncidents();
  const createIncident = useCreateSecurityIncident();
  const [title, setTitle] = useState("Security incident");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");

  return (
    <Stage11SecurityScaffold
      title="Incidents and containment"
      description="Incident mode centralizes containment decisions and blocks risky operational paths like builder access or external delivery."
    >
      <Card className="border-[color:var(--line)] bg-black/20">
        <CardHeader>
          <Badge variant="accent">new incident</Badge>
          <CardTitle>Create containment record</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_auto]">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <select
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as "low" | "medium" | "high" | "critical")
            }
            className="rounded-[18px] border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <Button
            onClick={() => {
              void createIncident.mutateAsync({ title, severity });
            }}
          >
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {(incidents.data ?? []).map((incident) => (
          <IncidentRow key={incident.id} incident={incident} />
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11CompliancePanel() {
  const activities = useComplianceProcessingActivities();
  const retentionPolicies = useRetentionPolicies();
  const retentionReport = useRetentionReport();
  const dsrRequests = useDsrRequests();

  return (
    <Stage11SecurityScaffold
      title="Compliance registry"
      description="Processing activities, retention posture and DSR workload sit alongside incident controls rather than in a separate disconnected admin area."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="ROPA activities" value={activities.data?.length ?? 0} hint="Registered processing activities in the active workspace." />
        <MetricCard label="retention policies" value={retentionPolicies.data?.length ?? 0} hint="Policies available for legal hold and deletion workflows." />
        <MetricCard label="open DSR" value={retentionReport.data?.dsrRequestsOpen ?? 0} hint="Requests still not completed." />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-[color:var(--line)] bg-white/4">
          <CardHeader>
            <Badge variant="muted">processing activities</Badge>
            <CardTitle>ROPA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(activities.data ?? []).map((item) => (
              <div key={item.id} className="rounded-[18px] border border-[color:var(--line)] bg-black/20 px-4 py-3">
                <div className="text-sm text-[color:var(--foreground)]">{item.activityCode}</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">{item.purpose}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--line)] bg-white/4">
          <CardHeader>
            <Badge variant="muted">DSR queue</Badge>
            <CardTitle>Subject rights requests</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(dsrRequests.data ?? []).map((item) => (
              <div key={item.id} className="rounded-[18px] border border-[color:var(--line)] bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[color:var(--foreground)]">{item.requestType}</span>
                  <Badge variant={item.status === "completed" ? "success" : "accent"}>{item.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  updated {formatTimestamp(item.updatedAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Stage11SecurityScaffold>
  );
}

export function Stage11AccessReviewsPanel() {
  const campaigns = useAccessReviewCampaigns();

  return (
    <Stage11SecurityScaffold
      title="Access reviews"
      description="Campaigns keep privileged workspace access under periodic review and tie directly into the security admin surface."
    >
      <div className="grid gap-3">
        {(campaigns.data ?? []).map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--foreground)]">{campaign.title}</div>
              <Badge variant={campaign.status === "completed" ? "success" : "accent"}>{campaign.status}</Badge>
            </div>
            <div className="mt-2 text-xs text-[color:var(--muted)]">
              due {formatTimestamp(campaign.dueAt)} • created {formatTimestamp(campaign.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </Stage11SecurityScaffold>
  );
}
