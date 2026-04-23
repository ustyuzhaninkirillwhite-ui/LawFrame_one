"use client";

import * as React from "react";
import {
  useAuditEvents,
  useCreateLegalWorkProfile,
  useCreateProfileImportJob,
  useCurrentLegalWorkProfile,
  useEffectiveLegalWorkProfile,
  useLegalWorkProfileVersions,
  usePreviewEffectiveLegalWorkProfile,
  usePublishLegalWorkProfile,
  useRestoreLegalWorkProfileVersion,
  useUpdateLegalWorkProfileDraft,
} from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "personal" | "team" | "effective" | "versions" | "audit" | "import";
type ScopedProfile = NonNullable<ReturnType<typeof useCurrentLegalWorkProfile>["data"]>;

export function Stage7ProfilePanel({ mode }: { readonly mode: Mode }) {
  const profileQuery = useCurrentLegalWorkProfile();
  const effectiveQuery = useEffectiveLegalWorkProfile();
  const currentProfile = profileQuery.data;
  const scopedProfile =
    mode === "team"
      ? (currentProfile?.profileType === "workspace" ? currentProfile : null)
      : mode === "personal" || mode === "versions"
        ? (currentProfile?.profileType === "personal" ? currentProfile : null)
        : currentProfile;
  const versionsQuery = useLegalWorkProfileVersions(scopedProfile?.id);
  const createProfile = useCreateLegalWorkProfile();
  const updateDraft = useUpdateLegalWorkProfileDraft(scopedProfile?.id);
  const publishProfile = usePublishLegalWorkProfile(scopedProfile?.id);
  const previewEffective = usePreviewEffectiveLegalWorkProfile(scopedProfile?.id);
  const restoreVersion = useRestoreLegalWorkProfileVersion(scopedProfile?.id);
  const auditEvents = useAuditEvents();
  const createImportJob = useCreateProfileImportJob();

  const [sourceDocumentId, setSourceDocumentId] = React.useState("");
  const [sourceDocumentVersionId, setSourceDocumentVersionId] = React.useState("");
  const profileType = mode === "team" ? "workspace" : "personal";

  const relevantAuditEvents = React.useMemo(
    () =>
      (auditEvents.data ?? []).filter((event) =>
        event.action.startsWith("profile.") ||
        event.action.startsWith("document.template.") ||
        event.action.startsWith("approval."),
      ),
    [auditEvents.data],
  );

  if (mode === "effective") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">effective profile</Badge>
          <CardTitle>Backend-computed merge snapshot</CardTitle>
          <CardDescription>
            Effective profile всегда считается на backend и фиксируется snapshot-ом для preview/run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
            {JSON.stringify(effectiveQuery.data?.effectiveContent ?? null, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  if (mode === "versions") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">versions</Badge>
          <CardTitle>Immutable publish history</CardTitle>
          <CardDescription>
            Published versions are immutable; restore creates a new draft version.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(versionsQuery.data ?? []).map((version) => (
            <div
              key={version.id}
              className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Version {version.version}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {version.status} • {version.createdAt}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void restoreVersion.mutateAsync({ versionId: version.id });
                  }}
                >
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (mode === "audit") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">audit</Badge>
          <CardTitle>Profile, template and approval audit trail</CardTitle>
          <CardDescription>
            Stage 7 writes profile publish, snapshot and approval events into the shared audit stream.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {relevantAuditEvents.map((event) => (
            <div key={event.id} className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4">
              <div className="text-sm font-medium">{event.action}</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {event.occurredAt} • {event.entityType ?? "entity"} • {event.result}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (mode === "import") {
    return (
      <Card>
        <CardHeader>
          <Badge variant="accent">import</Badge>
          <CardTitle>Draft-only import pipeline</CardTitle>
          <CardDescription>
            Existing documents create import suggestions only; active profiles are not replaced automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
            placeholder="Source document id"
            value={sourceDocumentId}
            onChange={(event) => setSourceDocumentId(event.target.value)}
          />
          <input
            className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
            placeholder="Source document version id"
            value={sourceDocumentVersionId}
            onChange={(event) => setSourceDocumentVersionId(event.target.value)}
          />
          <Button
            onClick={() => {
              void createImportJob.mutateAsync({
                sourceDocumentId,
                sourceDocumentVersionId,
                targetProfileId: scopedProfile?.id ?? null,
              });
            }}
          >
            Create Import Draft
          </Button>
          {createImportJob.data ? (
            <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
              {JSON.stringify(createImportJob.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <ProfileDraftEditor
      key={scopedProfile ? `${scopedProfile.id}:${scopedProfile.versions[0]?.id ?? "draft"}` : `${profileType}:new`}
      mode={mode}
      scopedProfile={scopedProfile ?? null}
      profileType={profileType}
      createProfile={createProfile}
      updateDraft={updateDraft}
      publishProfile={publishProfile}
      previewEffective={previewEffective}
    />
  );
}

function ProfileDraftEditor(props: {
  readonly mode: Extract<Mode, "personal" | "team">;
  readonly scopedProfile: ScopedProfile | null;
  readonly profileType: "personal" | "workspace";
  readonly createProfile: ReturnType<typeof useCreateLegalWorkProfile>;
  readonly updateDraft: ReturnType<typeof useUpdateLegalWorkProfileDraft>;
  readonly publishProfile: ReturnType<typeof usePublishLegalWorkProfile>;
  readonly previewEffective: ReturnType<typeof usePreviewEffectiveLegalWorkProfile>;
}) {
  const [name, setName] = React.useState(props.scopedProfile?.name ?? "");
  const [jsonContent, setJsonContent] = React.useState(
    JSON.stringify(props.scopedProfile?.versions[0]?.content ?? {}, null, 2),
  );
  const [previewJson, setPreviewJson] = React.useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">{props.mode === "team" ? "team profile" : "personal profile"}</Badge>
          <CardTitle>Draft, publish and preview profile policy</CardTitle>
          <CardDescription>
            Locked team rules stay on backend; personal overrides cannot silently remove them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
            placeholder="Profile name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <textarea
            className="min-h-[18rem] rounded-[24px] border border-[color:var(--line)] bg-black/10 p-4 text-sm"
            value={jsonContent}
            onChange={(event) => setJsonContent(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={async () => {
                const content = JSON.parse(jsonContent) as Record<string, unknown>;

                if (props.scopedProfile) {
                  await props.updateDraft.mutateAsync({ name, content });
                  return;
                }

                await props.createProfile.mutateAsync({
                  profileType: props.profileType,
                  name,
                  content,
                });
              }}
            >
              Save Draft
            </Button>
            <Button
              variant="ghost"
              disabled={!props.scopedProfile?.id}
              onClick={async () => {
                if (!props.scopedProfile?.id) {
                  return;
                }

                await props.publishProfile.mutateAsync();
              }}
            >
              Publish
            </Button>
            <Button
              variant="ghost"
              disabled={!props.scopedProfile?.id}
              onClick={async () => {
                if (!props.scopedProfile?.id) {
                  return;
                }

                const preview = await props.previewEffective.mutateAsync({
                  profileId: props.scopedProfile.id,
                  automationOverrides: {},
                });
                setPreviewJson(JSON.stringify(preview.snapshot.effectiveContent, null, 2));
              }}
            >
              Preview Effective
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewJson ? (
        <Card>
          <CardHeader>
            <Badge variant="muted">preview</Badge>
            <CardTitle>Effective preview snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
              {previewJson}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
