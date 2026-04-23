"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryState, RequirementPanel, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import { useClientTelemetry } from "@/hooks/use-client-telemetry";
import {
  useAutomationTemplate,
  useForkAutomationTemplate,
  useInstallAutomationTemplate,
  useTemplateRelated,
} from "@/hooks/use-stage0-data";

export function TemplateDetailPanel() {
  const params = useParams<{ templateId: string }>();
  const templateId = readParam(params.templateId);
  const template = useAutomationTemplate(templateId);
  const related = useTemplateRelated(templateId);
  const installMutation = useInstallAutomationTemplate(templateId);
  const forkMutation = useForkAutomationTemplate(templateId);
  const telemetry = useClientTelemetry();
  const [profileId, setProfileId] = useState("");
  const [documentIds, setDocumentIds] = useState("");
  const [connectionIds, setConnectionIds] = useState("");

  useEffect(() => {
    if (!template.data) {
      return;
    }

    telemetry("library.template.viewed", {
      templateId: template.data.id,
      scope: template.data.scope,
    });
  }, [telemetry, template.data]);

  if (template.isLoading || !template.data) {
    return (
      <QueryState
        title="Loading template detail"
        description="Resolving stage 3 detail, versions, requirements and install state."
      />
    );
  }

  const currentVersion = template.data.versions[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{template.data.owner}</Badge>
              <Badge variant="muted">{template.data.scope}</Badge>
              <Badge variant={badgeVariantForStatus(template.data.status)}>
                {template.data.status}
              </Badge>
              <Badge variant={badgeVariantForStatus(template.data.publicationStatus)}>
                {template.data.publicationStatus}
              </Badge>
              <Badge variant={badgeVariantForStatus(template.data.compatibilityStatus)}>
                {template.data.compatibilityStatus}
              </Badge>
              <Badge variant={badgeVariantForStatus(template.data.runtimeSyncState)}>
                sync {template.data.runtimeSyncState}
              </Badge>
            </div>
            <CardTitle>{template.data.title}</CardTitle>
            <CardDescription>{template.data.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
              <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Current version
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="accent">{template.data.version}</Badge>
                  <Badge variant="muted">{template.data.readiness}</Badge>
                </div>
              </div>
              <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Permissions
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.data.requiredPermissions.map((permission) => (
                    <Badge key={permission} variant="muted">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-[22px] border border-[color:var(--line)] bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Modules
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.data.moduleCodes.map((moduleCode) => (
                    <Badge key={moduleCode} variant="muted">
                      {moduleCode}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="ghost">
                <Link href={`/templates/${template.data.id}/edit`}>Edit draft</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/templates/${template.data.id}/publish`}>Publish flow</Link>
              </Button>
              <Button
                onClick={() => {
                  void forkMutation.mutateAsync({
                    title: `${template.data.title} fork`,
                    targetScope: "workspace",
                  });
                }}
                disabled={forkMutation.isPending}
              >
                Fork into workspace
              </Button>
            </div>
          </CardContent>
        </Card>

        <RequirementPanel requirements={template.data.requirements} />

        <Card>
          <CardHeader>
            <Badge variant="accent">install wizard</Badge>
            <CardTitle>Install into workspace</CardTitle>
            <CardDescription>
              Installation produces a workspace-owned copy pinned to the current source version. Runtime remains pending after install.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              placeholder="Profile id (optional)"
            />
            <Input
              value={documentIds}
              onChange={(event) => setDocumentIds(event.target.value)}
              placeholder="Document ids, comma-separated"
            />
            <Input
              value={connectionIds}
              onChange={(event) => setConnectionIds(event.target.value)}
              placeholder="Connection ids, comma-separated"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  void installMutation.mutateAsync({
                    profileId: profileId.trim() || undefined,
                    documentIds: splitCsv(documentIds),
                    connectionIds: splitCsv(connectionIds),
                    approvalPolicy: "manual",
                  });
                }}
                disabled={installMutation.isPending || !template.data.available}
              >
                Install with manual approval
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  void installMutation.mutateAsync({
                    profileId: profileId.trim() || undefined,
                    documentIds: splitCsv(documentIds),
                    connectionIds: splitCsv(connectionIds),
                    approvalPolicy: "auto_with_gate",
                  });
                }}
                disabled={installMutation.isPending || !template.data.available}
              >
                Install with gated auto mode
              </Button>
            </div>
            {template.data.disabledReason ? (
              <div className="text-sm leading-6 text-[color:var(--danger)]">
                {template.data.disabledReason}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Badge variant="muted">versions</Badge>
            <CardTitle>Template versions</CardTitle>
            <CardDescription>
              Draft and published versions stay explicit, and publication status travels with each version.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {template.data.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">{version.version}</Badge>
                  <Badge variant={badgeVariantForStatus(version.status)}>
                    {version.status}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(version.publicationStatus)}>
                    {version.publicationStatus}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(version.validationStatus)}>
                    {version.validationStatus}
                  </Badge>
                </div>
                <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  created {version.createdAt}
                </div>
                {version.requiredInputs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {version.requiredInputs.map((input) => (
                      <Badge key={input} variant="muted">
                        {input}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="muted">related</Badge>
            <CardTitle>Related templates</CardTitle>
            <CardDescription>Forks, public projections and sibling templates remain discoverable from the canonical detail page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(related.data ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-[color:var(--line)] bg-white/3 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-sm text-[color:var(--muted)]">
                      {item.description}
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/library/${item.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}
            {!related.data?.length && currentVersion ? (
              <div className="text-sm text-[color:var(--muted)]">
                No related templates are currently linked to version {currentVersion.version}.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
