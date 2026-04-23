"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useAcceptRecommendation,
  useDismissRecommendation,
  useRecommendationDetail,
  useRecommendationFeedback,
  useRecommendations,
  useSnoozeRecommendation,
} from "@/hooks/use-stage0-data";
import { useClientTelemetry } from "@/hooks/use-client-telemetry";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";
import { useSessionBridge } from "@/providers/session-provider";

type InboxScope = "personal" | "team" | "all";

export function RecommendationInbox({
  scope = "personal",
  adminMode = false,
}: {
  readonly scope?: InboxScope;
  readonly adminMode?: boolean;
}) {
  const telemetry = useClientTelemetry();
  const { sessionContext } = useSessionBridge();
  const recommendations = useRecommendations();
  const items = React.useMemo(() => {
    const source = recommendations.data ?? [];

    if (scope === "all") {
      return source;
    }

    return source.filter((item) => item.scope === scope);
  }, [recommendations.data, scope]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = React.useState("");
  const [feedbackType, setFeedbackType] = React.useState<
    "helpful" | "not_helpful" | "already_covered" | "too_risky" | "not_relevant"
  >("helpful");

  const activeId = React.useMemo(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) {
      return selectedId;
    }

    return items[0]?.id ?? null;
  }, [items, selectedId]);
  const detail = useRecommendationDetail(activeId);
  const acceptMutation = useAcceptRecommendation(activeId);
  const dismissMutation = useDismissRecommendation(activeId);
  const snoozeMutation = useSnoozeRecommendation(activeId);
  const feedbackMutation = useRecommendationFeedback(activeId);
  const activeDetail = detail.data;
  const canManageWorkspace = sessionContext.permissions.includes(
    "recommendation.manage",
  );

  React.useEffect(() => {
    if (!activeDetail) {
      return;
    }

    telemetry("recommendation.opened", {
      recommendationId: activeDetail.id,
      scope: activeDetail.scope,
      resourceType: "recommendation",
      resourceId: activeDetail.id,
    });
  }, [activeDetail, telemetry]);

  if (recommendations.isPending) {
    return (
      <QueryState
        title="Loading recommendation inbox"
        description="Product-event backed recommendations are still being resolved for the active workspace."
      />
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="muted">recommendations</Badge>
          <CardTitle>No visible candidates</CardTitle>
          <CardDescription>
            Personal inbox is empty. Recommendation engine stays advisory-only and
            will surface new candidates after repeated product activity.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="accent">advisory only</Badge>
            <Badge variant="muted">{scope === "all" ? "all scopes" : scope}</Badge>
          </div>
          <CardTitle>
            {adminMode
              ? "Workspace recommendation inbox"
              : "Recommendation inbox"}
          </CardTitle>
          <CardDescription>
            Candidates are inferred from product events, but they never publish,
            sync or deliver anything on their own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((recommendation) => {
            const active = recommendation.id === activeId;
            return (
              <button
                key={recommendation.id}
                type="button"
                className={`w-full rounded-[24px] border p-5 text-left transition ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8"
                    : "border-[color:var(--line)] bg-black/20 hover:border-[color:var(--accent)]/30"
                }`}
                onClick={() => {
                  setSelectedId(recommendation.id);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForStatus(recommendation.status)}>
                    {recommendation.status}
                  </Badge>
                  <Badge variant={badgeVariantForStatus(recommendation.riskLevel)}>
                    {recommendation.riskLevel}
                  </Badge>
                  <Badge variant="muted">{recommendation.scope}</Badge>
                </div>
                <div className="mt-4 text-xl font-[family-name:var(--font-display)]">
                  {recommendation.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                  {recommendation.summary}
                </p>
                <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.24em] text-[color:var(--muted)] sm:grid-cols-3">
                  <span>{recommendation.repeatCount} repeats</span>
                  <span>{recommendation.periodDays} day window</span>
                  <span>{recommendation.estimatedTimeSavedMinutes} min saved</span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        {activeDetail ? (
          <>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={badgeVariantForStatus(activeDetail.status)}>
                  {activeDetail.status}
                </Badge>
                <Badge variant={badgeVariantForStatus(activeDetail.riskLevel)}>
                  {activeDetail.riskLevel}
                </Badge>
                <Badge variant="muted">{activeDetail.scope}</Badge>
              </div>
              <CardTitle>{activeDetail.title}</CardTitle>
              <CardDescription>{activeDetail.rationale}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricTile
                  label="Repeat count"
                  value={String(activeDetail.repeatCount)}
                />
                <MetricTile
                  label="Period"
                  value={`${activeDetail.periodDays} days`}
                />
                <MetricTile
                  label="Time saved"
                  value={`${activeDetail.estimatedTimeSavedMinutes} min`}
                />
              </div>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Explainability
                </div>
                <div className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4 text-sm leading-6 text-[color:var(--muted-strong)]">
                  {activeDetail.explainabilitySummary}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Activity sequence
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeDetail.activitySequence.map((activity) => (
                    <Badge key={activity} variant="muted">
                      {activity}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Workflow preview
                </div>
                <div className="space-y-3 rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
                  {activeDetail.workflowSkeleton.steps.map((step) => (
                    <div
                      key={step.stepId}
                      className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{step.kind}</Badge>
                        <Badge variant="muted">{step.moduleCode}</Badge>
                        {step.requiresApproval ? (
                          <Badge variant="accent">approval gate</Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 text-base font-medium">{step.title}</div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {step.description}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Safety
                </div>
                <div className="rounded-[24px] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/8 p-4 text-sm leading-6 text-[color:var(--muted-strong)]">
                  External delivery will not be automated without explicit
                  approval. Accepting this candidate only creates a workflow draft.
                </div>
                {activeDetail.warnings.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeDetail.warnings.map((warning) => (
                      <Badge key={warning} variant="accent">
                        {warning}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </section>

              {activeDetail.missingInputs.length > 0 ? (
                <section className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    Missing inputs
                  </div>
                  <div className="space-y-3">
                    {activeDetail.missingInputs.map((item) => (
                      <div
                        key={item.field}
                        className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="muted">{item.type}</Badge>
                          {item.required ? <Badge variant="danger">required</Badge> : null}
                        </div>
                        <div className="mt-3 text-base font-medium">{item.label}</div>
                        {item.helpText ? (
                          <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {item.helpText}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    telemetry("recommendation.accept_requested", {
                      recommendationId: activeDetail.id,
                      scope: activeDetail.scope,
                      resourceType: "recommendation",
                      resourceId: activeDetail.id,
                    });
                    void acceptMutation.mutateAsync({});
                  }}
                  disabled={acceptMutation.isPending}
                >
                  Accept into draft
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    telemetry("recommendation.dismiss_requested", {
                      recommendationId: activeDetail.id,
                      scope: activeDetail.scope,
                      resourceType: "recommendation",
                      resourceId: activeDetail.id,
                    });
                    void dismissMutation.mutateAsync({});
                  }}
                  disabled={dismissMutation.isPending}
                >
                  Dismiss
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => {
                    telemetry("recommendation.snooze_requested", {
                      recommendationId: activeDetail.id,
                      scope: activeDetail.scope,
                      resourceType: "recommendation",
                      resourceId: activeDetail.id,
                    });
                    void snoozeMutation.mutateAsync({ days: 7 });
                  }}
                  disabled={snoozeMutation.isPending}
                >
                  Snooze 7 days
                </Button>
                {adminMode && canManageWorkspace ? (
                  <Button asChild variant="ghost">
                    <Link href="/admin/recommendations">Open admin analytics</Link>
                  </Button>
                ) : null}
              </div>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Feedback
                </div>
                <select
                  className="w-full rounded-[20px] border border-[color:var(--line)] bg-white/4 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                  value={feedbackType}
                  onChange={(event) => {
                    setFeedbackType(
                      event.target.value as typeof feedbackType,
                    );
                  }}
                >
                  <option value="helpful">Helpful</option>
                  <option value="not_helpful">Not helpful</option>
                  <option value="already_covered">Already covered</option>
                  <option value="too_risky">Too risky</option>
                  <option value="not_relevant">Not relevant</option>
                </select>
                <Textarea
                  value={feedbackNote}
                  onChange={(event) => {
                    setFeedbackNote(event.target.value);
                  }}
                  placeholder="Optional note for scoring and suppression decisions."
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    telemetry("recommendation.feedback_submitted", {
                      recommendationId: activeDetail.id,
                      feedbackType,
                      resourceType: "recommendation",
                      resourceId: activeDetail.id,
                    });
                    void feedbackMutation
                      .mutateAsync({
                        feedbackType,
                        note: feedbackNote || null,
                      })
                      .then(() => {
                        setFeedbackNote("");
                      });
                  }}
                  disabled={feedbackMutation.isPending}
                >
                  Send feedback
                </Button>
              </section>

              {acceptMutation.data?.workflowDraft ? (
                <section className="rounded-[24px] border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">draft created</Badge>
                    <Badge variant="muted">{acceptMutation.data.workflowDraft.id}</Badge>
                  </div>
                  <div className="mt-3 text-base font-medium">
                    {acceptMutation.data.workflowDraft.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[color:var(--muted-strong)]">
                    {acceptMutation.data.message}
                  </div>
                </section>
              ) : null}
            </CardContent>
          </>
        ) : (
          <CardHeader>
            <Badge variant="muted">recommendations</Badge>
            <CardTitle>Select a candidate</CardTitle>
            <CardDescription>
              Detail view loads the workflow skeleton, missing inputs and safety
              guards for the selected recommendation.
            </CardDescription>
          </CardHeader>
        )}
      </Card>
    </div>
  );
}

function MetricTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-3 text-2xl font-[family-name:var(--font-display)]">
        {value}
      </div>
    </div>
  );
}
