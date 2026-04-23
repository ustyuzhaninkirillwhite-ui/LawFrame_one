import type {
  ProcessCaseSummary,
  ProductEventCaptureRequest,
  ProductEventCaptureResponse,
  RecommendationActionResult,
  RecommendationDetail,
  RecommendationPatternDetail,
  RecommendationPatternSummary,
  RecommendationQualitySnapshot,
} from "../domain";
import { aiDraftFixture, aiRuntimePlanFixture, aiWorkflowFixture } from "./ai-fixtures";
import { recommendationsFixture } from "./demo-data";

const personalRecommendation = recommendationsFixture[0]!;
const teamRecommendation = recommendationsFixture[1]!;

export const recommendationQualitySnapshotFixture: RecommendationQualitySnapshot =
  {
    capturedAt: "2026-04-21T13:25:00.000Z",
    metrics: [
      {
        name: "events_without_trace_id",
        value: 1.8,
        unit: "percent",
        window: "24h",
        warning: false,
      },
      {
        name: "quarantine_spike",
        value: 3,
        unit: "count",
        window: "24h",
        warning: false,
      },
      {
        name: "mining_lag",
        value: 17,
        unit: "minutes",
        window: "24h",
        warning: false,
      },
    ],
    miningLagMinutes: 17,
    quarantineRatePercent: 1.4,
    missingTraceRatePercent: 1.8,
  };

export const processCasesFixture: readonly ProcessCaseSummary[] = [
  {
    id: "pcase_001",
    scope: "personal",
    caseKey: "synthetic:claim-pretrial:01",
    processInstanceId: null,
    sessionId: "sess_stage9_claim_01",
    traceId: "trace_8fd212da0b214c9b",
    runId: "run_001",
    actorIds: ["usr_01hzyd6z9n0d8t02h0j1h0a1zz"],
    activitySequence: personalRecommendation.activitySequence,
    eventCount: 8,
    startedAt: "2026-04-20T09:00:00.000Z",
    finishedAt: "2026-04-20T09:18:00.000Z",
    durationMs: 1_080_000,
    status: "completed",
  },
  {
    id: "pcase_002",
    scope: "personal",
    caseKey: "synthetic:claim-pretrial:02",
    processInstanceId: null,
    sessionId: "sess_stage9_claim_02",
    traceId: "trace_384e0c2a9be14048",
    runId: "run_002",
    actorIds: ["usr_01hzyd6z9n0d8t02h0j1h0a1zz"],
    activitySequence: personalRecommendation.activitySequence,
    eventCount: 7,
    startedAt: "2026-04-21T08:20:00.000Z",
    finishedAt: "2026-04-21T08:24:00.000Z",
    durationMs: 240_000,
    status: "completed",
  },
  {
    id: "pcase_003",
    scope: "team",
    caseKey: "team:contract-review:03",
    processInstanceId: "proc_contract_review_03",
    sessionId: "sess_stage9_team_03",
    traceId: "trace_team_03",
    runId: null,
    actorIds: [
      "usr_01hzyd6z9n0d8t02h0j1h0a1zz",
      "usr_01hzyteamreview00000000001",
      "usr_01hzyteamreview00000000002",
    ],
    activitySequence: teamRecommendation.activitySequence,
    eventCount: 9,
    startedAt: "2026-04-18T11:00:00.000Z",
    finishedAt: "2026-04-18T11:26:00.000Z",
    durationMs: 1_560_000,
    status: "completed",
  },
] as const;

export const recommendationPatternsFixture: readonly RecommendationPatternSummary[] =
  [
    {
      id: "pat_pretrial_claim_01",
      scope: "personal",
      title: personalRecommendation.title,
      strategy: "prefixspan",
      activitySequence: personalRecommendation.activitySequence,
      caseCount: 6,
      distinctUserCount: 1,
      repeatCount: personalRecommendation.repeatCount,
      periodDays: personalRecommendation.periodDays,
      riskLevel: personalRecommendation.riskLevel,
      explainabilitySummary: personalRecommendation.explainabilitySummary,
      overlapStatus: "none",
      status: "candidate",
      lastSeenAt: personalRecommendation.lastSeenAt,
    },
    {
      id: "pat_workspace_review_02",
      scope: "team",
      title: teamRecommendation.title,
      strategy: "pm4py",
      activitySequence: teamRecommendation.activitySequence,
      caseCount: 11,
      distinctUserCount: 3,
      repeatCount: teamRecommendation.repeatCount,
      periodDays: teamRecommendation.periodDays,
      riskLevel: teamRecommendation.riskLevel,
      explainabilitySummary: teamRecommendation.explainabilitySummary,
      overlapStatus: "installed_template",
      status: "candidate",
      lastSeenAt: teamRecommendation.lastSeenAt,
    },
  ] as const;

export const recommendationPatternDetailFixture: RecommendationPatternDetail = {
  ...recommendationPatternsFixture[0]!,
  qualitySnapshot: recommendationQualitySnapshotFixture,
  exampleCases: processCasesFixture.filter((item) => item.scope === "personal"),
  moduleMapping: [
    {
      activityCode: "search.query.completed",
      moduleCode: "legal.case-search",
      confidence: 0.98,
      resolution: "deterministic",
    },
    {
      activityCode: "document.generation.previewed",
      moduleCode: "document.pretrial-draft",
      confidence: 0.91,
      resolution: "template_hint",
    },
    {
      activityCode: "delivery.request.created",
      moduleCode: "delivery.email-draft",
      confidence: 0.96,
      resolution: "deterministic",
    },
  ],
  warnings: [
    "Delivery steps remain draft-only until explicit approval and save/publish.",
  ],
};

const recommendationWorkflowSkeleton = {
  ...aiWorkflowFixture,
  id: "wf_recommendation_pretrial_001",
  title: "Recommendation draft: pre-trial claim workflow",
  description:
    "Deterministic workflow skeleton generated from repeated product activity.",
  intent:
    "Turn repeated research, drafting and approval-safe delivery preparation into a reusable workflow draft.",
  createdBy: "human" as const,
  metadata: {
    sourceRecommendationId: personalRecommendation.id,
    activitySequence: personalRecommendation.activitySequence,
  },
};

export const recommendationDetailsFixture: readonly RecommendationDetail[] = [
  {
    ...personalRecommendation,
    pattern: recommendationPatternsFixture[0]!,
    workflowSkeleton: recommendationWorkflowSkeleton,
    validationReport: aiDraftFixture.validationReport,
    policyReport: aiDraftFixture.policyReport,
    runtimePlanPreview: aiRuntimePlanFixture,
    missingInputs: [
      {
        field: "claim_template",
        label: "Claim template",
        type: "template",
        required: true,
        helpText:
          "Recommendation identified the drafting step, but the concrete workspace template stays explicit.",
      },
    ],
    sourceTraceIds: processCasesFixture
      .filter((item) => item.scope === "personal")
      .map((item) => item.traceId ?? "unknown"),
    similarTemplateIds: ["tpl_pretenziya_001", "tpl_workspace_claim_001"],
    feedbackHistory: [
      {
        id: "rec_feedback_001",
        actorUserId: "usr_01hzyd6z9n0d8t02h0j1h0a1zz",
        feedbackType: "helpful",
        note: "Useful when the claim template is already selected.",
        createdAt: "2026-04-21T13:00:00.000Z",
      },
    ],
  },
  {
    ...teamRecommendation,
    pattern: recommendationPatternsFixture[1]!,
    workflowSkeleton: {
      ...recommendationWorkflowSkeleton,
      id: "wf_recommendation_team_review_002",
      title: "Recommendation draft: workspace contract review intake",
      metadata: {
        sourceRecommendationId: teamRecommendation.id,
        activitySequence: teamRecommendation.activitySequence,
      },
    },
    validationReport: aiDraftFixture.validationReport,
    policyReport: aiDraftFixture.policyReport,
    runtimePlanPreview: aiRuntimePlanFixture,
    missingInputs: [
      {
        field: "review_document_type",
        label: "Review document type",
        type: "select",
        required: true,
        options: [
          { value: "contract_review", label: "Contract review" },
          { value: "vendor_review", label: "Vendor review" },
        ],
      },
    ],
    sourceTraceIds: ["trace_team_03"],
    similarTemplateIds: ["tpl_public_contract_review_001"],
    feedbackHistory: [],
  },
] as const;

export const recommendationDetailFixture = recommendationDetailsFixture[0]!;
export const teamRecommendationDetailFixture = recommendationDetailsFixture[1]!;

export const recommendationActionResultFixture: RecommendationActionResult = {
  recommendationId: recommendationDetailFixture.id,
  status: "accepted",
  draftId: "draft_01hzrecommendation",
  workflowDraft: {
    ...aiDraftFixture,
    id: "draft_01hzrecommendation",
    source: "recommendation",
    title: recommendationDetailFixture.workflowSkeleton.title,
    workflow: recommendationDetailFixture.workflowSkeleton,
  },
  notificationId: "notif_recommendation_accepted_001",
  snoozedUntil: null,
  message:
    "Recommendation was converted into a workflow draft. External delivery remains approval-gated and not synced to Activepieces.",
};

export const productEventCaptureRequestFixture: ProductEventCaptureRequest = {
  eventName: "recommendation.opened",
  eventTime: "2026-04-21T13:26:00.000Z",
  sessionId: "sess_stage9_claim_02",
  traceId: "trace_rec_open_001",
  workspaceId: "ws_01hzyd70jqgr8k9gr6m4y80p81",
  resourceType: "recommendation",
  resourceId: recommendationDetailFixture.id,
  processInstanceId: null,
  runId: null,
  properties: {
    recommendationId: recommendationDetailFixture.id,
    scope: recommendationDetailFixture.scope,
  },
  clientEventId: "evt_client_rec_open_001",
  idempotencyKey: "evt_client_rec_open_001",
  source: "frontend",
};

export const productEventCaptureResponseFixture: ProductEventCaptureResponse = {
  status: "queued",
  eventId: "pevt_01hzcapture001",
  outboxId: "outbox_01hzcapture001",
  quarantineId: null,
  traceId: productEventCaptureRequestFixture.traceId,
};
