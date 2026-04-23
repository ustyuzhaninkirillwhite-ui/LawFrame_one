"use client";

import * as React from "react";
import { eventCatalog } from "@lexframe/contracts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useRecommendationPattern,
  useRecommendationPatterns,
  useRecommendationProcessCases,
} from "@/hooks/use-stage0-data";
import { JsonPreview, QueryState, badgeVariantForStatus } from "@/components/stage3-shared";

export function RecommendationAdminAnalytics() {
  const patterns = useRecommendationPatterns();
  const processCases = useRecommendationProcessCases();
  const [selectedPatternId, setSelectedPatternId] = React.useState<string | null>(
    null,
  );
  const activePatternId = React.useMemo(() => {
    if (
      selectedPatternId &&
      patterns.data?.some((pattern) => pattern.id === selectedPatternId)
    ) {
      return selectedPatternId;
    }

    return patterns.data?.[0]?.id ?? null;
  }, [patterns.data, selectedPatternId]);
  const patternDetail = useRecommendationPattern(activePatternId);

  if (patterns.isPending || processCases.isPending) {
    return (
      <QueryState
        title="Loading recommendation analytics"
        description="Process cases, mined patterns and quality metrics are still being loaded."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <Card>
        <CardHeader>
          <Badge variant="accent">admin</Badge>
          <CardTitle>Pattern review</CardTitle>
          <CardDescription>
            Team-level candidates, pattern overlap and suppression context for the
            active workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {patterns.data?.map((pattern) => {
            const active = pattern.id === activePatternId;
            return (
              <button
                key={pattern.id}
                type="button"
                className={`w-full rounded-[24px] border p-5 text-left transition ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8"
                    : "border-[color:var(--line)] bg-black/20 hover:border-[color:var(--accent)]/30"
                }`}
                onClick={() => {
                  setSelectedPatternId(pattern.id);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForStatus(pattern.riskLevel)}>
                    {pattern.riskLevel}
                  </Badge>
                  <Badge variant="muted">{pattern.strategy}</Badge>
                  <Badge variant="muted">{pattern.scope}</Badge>
                </div>
                <div className="mt-4 text-xl font-[family-name:var(--font-display)]">
                  {pattern.title}
                </div>
                <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  {pattern.explainabilitySummary}
                </div>
                <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.24em] text-[color:var(--muted)] sm:grid-cols-3">
                  <span>{pattern.caseCount} cases</span>
                  <span>{pattern.distinctUserCount} users</span>
                  <span>{pattern.periodDays} days</span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {patternDetail.data ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={badgeVariantForStatus(patternDetail.data.riskLevel)}>
                  {patternDetail.data.riskLevel}
                </Badge>
                <Badge variant="muted">{patternDetail.data.strategy}</Badge>
              </div>
              <CardTitle>{patternDetail.data.title}</CardTitle>
              <CardDescription>
                {patternDetail.data.explainabilitySummary}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricTile
                  label="Cases"
                  value={String(patternDetail.data.caseCount)}
                />
                <MetricTile
                  label="Users"
                  value={String(patternDetail.data.distinctUserCount)}
                />
                <MetricTile
                  label="Lag"
                  value={`${patternDetail.data.qualitySnapshot.miningLagMinutes} min`}
                />
              </div>

              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Module mapping
                </div>
                <div className="space-y-3">
                  {patternDetail.data.moduleMapping.map((item) => (
                    <div
                      key={`${item.activityCode}:${item.moduleCode}`}
                      className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{item.activityCode}</Badge>
                        <Badge variant="muted">{item.moduleCode}</Badge>
                        <Badge variant="accent">{item.resolution}</Badge>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                        Confidence {Math.round(item.confidence * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <JsonPreview
                title="Quality snapshot"
                description="Mining lag, quarantine rate and trace coverage surfaced for admin review."
                value={patternDetail.data.qualitySnapshot}
              />
            </CardContent>
          </Card>
        ) : (
          <QueryState
            title="Select a pattern"
            description="Detailed module mapping and quality metrics appear after a pattern is selected."
          />
        )}

        <Card>
          <CardHeader>
            <Badge variant="muted">process cases</Badge>
            <CardTitle>Case explorer</CardTitle>
            <CardDescription>
              Sessionized process cases that support recommendation explainability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {processCases.data?.map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{item.scope}</Badge>
                  <Badge variant={badgeVariantForStatus(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                <div className="mt-3 text-base font-medium">{item.caseKey}</div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {item.activitySequence.join(" -> ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <JsonPreview
          title="Event catalog viewer"
          description="Canonical activity codes, risk flags and allowed sources used by product-event governance."
          value={eventCatalog}
        />
      </div>
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
