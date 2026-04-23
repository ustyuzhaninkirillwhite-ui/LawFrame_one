"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsonPreview, QueryState, badgeVariantForStatus, readParam } from "@/components/stage3-shared";
import {
  useApplyInstalledAutomationSourceUpdate,
  useAutomationDetail,
  useAutomationTemplate,
  useCreateAutomationTemplateVersion,
  useInstalledAutomationSourceDiff,
  useModerationPublicationRequests,
  useMyAutomationTemplates,
  usePublishAutomationTemplateDraft,
  useSubmitAutomationTemplatePublication,
  useUpdateAutomationTemplate,
} from "@/hooks/use-stage0-data";

type AutomationTemplateData = NonNullable<ReturnType<typeof useAutomationTemplate>["data"]>;

export function MyTemplatesPanel() {
  const { data = [], isLoading } = useMyAutomationTemplates();

  if (isLoading) {
    return (
      <QueryState
        title="Loading workspace templates"
        description="Resolving workspace/private drafts and their publication states."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((template) => (
        <Card key={template.id}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{template.scope}</Badge>
                <Badge variant={badgeVariantForStatus(template.status)}>
                  {template.status}
                </Badge>
                <Badge variant={badgeVariantForStatus(template.publicationStatus)}>
                  {template.publicationStatus}
                </Badge>
              </div>
              <div>
                <CardTitle>{template.title}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="ghost">
                <Link href={`/templates/${template.id}/edit`}>Edit</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/templates/${template.id}/publication-status`}>Status</Link>
              </Button>
              <Button asChild>
                <Link href={`/templates/${template.id}/publish`}>Publish</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function TemplateEditorPanel() {
  const params = useParams<{ id: string }>();
  const templateId = readParam(params.id);
  const template = useAutomationTemplate(templateId);
  const updateMutation = useUpdateAutomationTemplate(templateId);
  const createVersionMutation = useCreateAutomationTemplateVersion(templateId);

  if (template.isLoading || !template.data) {
    return (
      <QueryState
        title="Loading template editor"
        description="Resolving current draft, workflow payload and version history."
      />
    );
  }

  const currentVersion = template.data.versions[0];

  return (
    <TemplateMetadataEditor
      key={`${template.data.id}:${currentVersion?.id ?? "draft"}`}
      template={template.data}
      updateMutation={updateMutation}
      createVersionMutation={createVersionMutation}
    />
  );
}

export function TemplatePublicationPanel() {
  const params = useParams<{ id: string }>();
  const templateId = readParam(params.id);
  const template = useAutomationTemplate(templateId);
  const [note, setNote] = useState("");
  const currentVersion = template.data?.versions[0];
  const publishMutation = usePublishAutomationTemplateDraft(currentVersion?.id);
  const submitMutation = useSubmitAutomationTemplatePublication(templateId);

  if (template.isLoading || !template.data) {
    return (
      <QueryState
        title="Loading publication flow"
        description="Resolving current version and publication readiness checks."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <Badge variant="accent">publish draft</Badge>
          <CardTitle>Internal draft publication</CardTitle>
          <CardDescription>
            This step promotes the current draft version to the canonical workspace version before public moderation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{template.data.version}</Badge>
            <Badge variant={badgeVariantForStatus(currentVersion?.validationStatus ?? "invalid")}>
              {currentVersion?.validationStatus ?? "invalid"}
            </Badge>
          </div>
          <Button
            onClick={() => {
              void publishMutation.mutateAsync();
            }}
            disabled={publishMutation.isPending || !currentVersion}
          >
            Publish current draft
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="accent">moderation</Badge>
          <CardTitle>Submit to public library</CardTitle>
          <CardDescription>
            Pre-submit checks must pass before the workspace template enters the moderation queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Moderator note or release context"
          />
          <Button
            onClick={() => {
              void submitMutation.mutateAsync({
                note: note.trim() || undefined,
              });
            }}
            disabled={submitMutation.isPending}
          >
            Submit publication request
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateMetadataEditor(props: {
  readonly template: AutomationTemplateData;
  readonly updateMutation: ReturnType<typeof useUpdateAutomationTemplate>;
  readonly createVersionMutation: ReturnType<typeof useCreateAutomationTemplateVersion>;
}) {
  const [title, setTitle] = useState(props.template.title);
  const [category, setCategory] = useState(props.template.category);
  const [description, setDescription] = useState(props.template.description);
  const currentVersion = props.template.versions[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <Badge variant="accent">metadata</Badge>
          <CardTitle>Edit template metadata</CardTitle>
          <CardDescription>
            Title, category and description stay on the template root while workflow content lives on versions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input value={category} onChange={(event) => setCategory(event.target.value)} />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                void props.updateMutation.mutateAsync({
                  title,
                  category,
                  description,
                });
              }}
              disabled={props.updateMutation.isPending}
            >
              Save metadata
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (!currentVersion) {
                  return;
                }

                void props.createVersionMutation.mutateAsync({
                  version: nextVersion(props.template.versions.map((item) => item.version)),
                  workflow: props.template.workflow,
                  requirements: props.template.requirements,
                });
              }}
              disabled={props.createVersionMutation.isPending || !currentVersion}
            >
              Create draft version
            </Button>
          </div>
        </CardContent>
      </Card>

      <JsonPreview
        title="Current workflow payload"
        description="Version creation currently snapshots the canonical workflow and requirements as-is."
        value={{
          workflow: props.template.workflow,
          requirements: props.template.requirements,
        }}
      />
    </div>
  );
}

export function TemplatePublicationStatusPanel() {
  const params = useParams<{ id: string }>();
  const templateId = readParam(params.id);
  const template = useAutomationTemplate(templateId);
  const requests = useModerationPublicationRequests();

  if (template.isLoading || !template.data) {
    return (
      <QueryState
        title="Loading publication status"
        description="Resolving template status and any moderation queue entries."
      />
    );
  }

  const matchingRequest = (requests.data ?? []).find(
    (request) => request.templateId === template.data?.id,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <Badge variant="accent">template</Badge>
          <CardTitle>Publication snapshot</CardTitle>
          <CardDescription>
            Workspace draft and public projection are separated, but their statuses are still visible here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={badgeVariantForStatus(template.data.publicationStatus)}>
              {template.data.publicationStatus}
            </Badge>
            <Badge variant={badgeVariantForStatus(template.data.compatibilityStatus)}>
              {template.data.compatibilityStatus}
            </Badge>
            <Badge variant="muted">{template.data.runtimeSyncState}</Badge>
          </div>
          <div className="text-sm leading-6 text-[color:var(--muted)]">
            {template.data.disabledReason ?? "No backend-issued blocker is active right now."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">request</Badge>
          <CardTitle>Moderation record</CardTitle>
          <CardDescription>
            The current workspace view shows the latest moderation object when it is visible to this actor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {matchingRequest ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={badgeVariantForStatus(matchingRequest.status)}>
                  {matchingRequest.status}
                </Badge>
                <Badge variant="muted">{matchingRequest.id}</Badge>
              </div>
              <div className="text-sm text-[color:var(--muted)]">
                submitted {matchingRequest.submittedAt}
              </div>
              {matchingRequest.reviewNote ? (
                <div className="text-sm leading-6 text-[color:var(--muted-strong)]">
                  {matchingRequest.reviewNote}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-[color:var(--muted)]">
              No visible moderation request matched this template in the current queue snapshot.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AutomationUpdatesPanel() {
  const params = useParams<{ id: string }>();
  const automationId = readParam(params.id);
  const automation = useAutomationDetail(automationId);
  const diff = useInstalledAutomationSourceDiff(automationId);
  const applyMutation = useApplyInstalledAutomationSourceUpdate(automationId);

  if (automation.isLoading || diff.isLoading || !automation.data || !diff.data) {
    return (
      <QueryState
        title="Loading source updates"
        description="Resolving pinned source version against the latest template version."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <Badge variant="accent">current install</Badge>
          <CardTitle>{automation.data.title}</CardTitle>
          <CardDescription>
            Installed automation stays pinned until you explicitly apply the source update.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{automation.data.sourceTemplateVersionId}</Badge>
            <Badge variant={badgeVariantForStatus(automation.data.syncState)}>
              {automation.data.syncState}
            </Badge>
          </div>
          <div className="text-sm leading-6 text-[color:var(--muted)]">
            {automation.data.nextGate}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="accent">source diff</Badge>
          <CardTitle>{diff.data.hasUpdates ? "Updates available" : "Up to date"}</CardTitle>
          <CardDescription>{diff.data.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {diff.data.changedModuleCodes.map((moduleCode) => (
              <Badge key={moduleCode} variant="muted">
                {moduleCode}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {diff.data.changedRequirementCodes.map((requirementCode) => (
              <Badge key={requirementCode} variant="danger">
                {requirementCode}
              </Badge>
            ))}
          </div>
          <Button
            onClick={() => {
              void applyMutation.mutateAsync({
                targetTemplateVersionId: diff.data.targetTemplateVersionId,
              });
            }}
            disabled={applyMutation.isPending || !diff.data.hasUpdates}
          >
            Apply source update
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function nextVersion(versions: readonly string[]) {
  const highest = versions.reduce((max, value) => {
    const match = /^v(\d+)$/i.exec(value);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `v${highest + 1}`;
}
