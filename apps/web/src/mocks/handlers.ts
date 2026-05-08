import type {
  ApprovalTaskSummary,
  AuditEventSummary,
  CompleteUploadRequest,
  CreateDocumentVersionUploadIntentRequest,
  CreateRunArtifactRequest,
  DashboardEventListResponse,
  DashboardSnapshot,
  CreateWorkspaceInvitationRequest,
  DocumentDetail,
  DocumentKind,
  DocumentListQuery,
  LegalImportJob,
  LegalSearchQuery,
  LegalSearchResponse,
  LegalSourceDetail,
  LegalSourceSummary,
  NotificationListResponse,
  NotificationSummary,
  RagRequestSummary,
  DocumentObjectRole,
  DocumentStatus,
  DocumentSummary,
  DocumentUploadIntentRequest,
  DocumentVersionSummary,
  RunLiveSnapshot,
  RunArtifact,
  SessionContext,
  SettingsBootstrapResponse,
  AiProviderConnectionDto,
  AiSettingsResponse,
  AiRouteGroupPreferenceDto,
  CreateAiProviderConnectionRequest,
  UpdateAiProviderConnectionRequest,
  UpdateAiRouteGroupPreferenceRequest,
  SystemStatusSummary,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceInvitation,
  WorkspaceMember,
} from "@lexframe/contracts";
import {
  activepiecesEmbedTokenFixture,
  automationTemplateDetailFixture,
  automationTemplateVersionsFixture,
  auditEventsFixture,
  documentDetailFixture,
  documentsFixture,
  installedAutomationFixture,
  installedAutomationSourceDiffFixture,
  legalAnalysisOutputFixture,
  legalImportJobFixture,
  legalSearchResponseFixture,
  legalSourceDetailFixture,
  legalSourceSummaryFixture,
  legalModuleDetailFixture,
  legalModulesFixture,
  libraryTemplatesFixture,
  permissionDefinitionsFixture,
  publicationRequestsFixture,
  readinessFixture,
  recommendationsFixture,
  roleDefinitionsFixture,
  ragRequestFixture,
  runArtifactsFixture,
  runsFixture,
  securityAccountFixture,
  sessionContextFixture,
} from "@lexframe/contracts";
import { HttpResponse, http } from "msw";
import {
  buildStage15ProjectSnapshot,
  stage15Handlers,
} from "./stage15-handlers";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

const workspaceMembersFixture: readonly WorkspaceMember[] = [
  {
    id: "member_owner",
    userId: sessionContextFixture.actor!.id,
    email: sessionContextFixture.actor!.email,
    fullName: sessionContextFixture.actor!.fullName,
    role: "owner",
    status: "active",
    joinedAt: "2026-04-21T08:00:00.000Z",
    lastActiveAt: "2026-04-21T10:00:00.000Z",
  },
  {
    id: "member_lawyer",
    userId: "usr_stage2_lawyer",
    email: "lawyer@lexframe.local",
    fullName: "Stage 2 Lawyer",
    role: "lawyer",
    status: "active",
    joinedAt: "2026-04-21T08:30:00.000Z",
    lastActiveAt: "2026-04-21T09:45:00.000Z",
  },
] as const;

const workspaceInvitationsFixture: readonly WorkspaceInvitation[] = [
  {
    id: "inv_stage2_01",
    email: "viewer@lexframe.local",
    role: "viewer",
    status: "pending",
    expiresAt: "2026-04-28T09:00:00.000Z",
    createdAt: "2026-04-21T09:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
    deliveryMode: "mock",
    deliveryPreview: {
      acceptToken: "mock-token",
      acceptUrl: "http://127.0.0.1:3000/invite/mock-token",
    },
  },
] as const;

interface MockState {
  sessionContext: SessionContext;
  documents: Map<string, DocumentDetail>;
  legalSources: Map<string, LegalSourceDetail>;
  legalImportJobs: LegalImportJob[];
  ragRequests: Map<string, RagRequestSummary>;
  runArtifacts: RunArtifact[];
  notifications: NotificationSummary[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  auditEvents: AuditEventSummary[];
}

const approvalTasksFixture: readonly ApprovalTaskSummary[] = [
  {
    id: "approval_001",
    workspaceId: sessionContextFixture.activeWorkspace?.id ?? "ws_demo",
    routeId: "route_stage7_delivery",
    generationJobId: null,
    workflowRunId: "run_001",
    title: "Approve delivery draft for case A40-101/2026",
    status: "pending",
    approverUserId: sessionContextFixture.actor?.id ?? null,
    approverRole: "owner",
    dueAt: "2026-04-21T18:00:00.000Z",
    decisionComment: null,
    createdAt: "2026-04-21T09:06:00.000Z",
    decidedAt: null,
  },
] as const;

function buildInitialNotifications(): NotificationSummary[] {
  return [
    {
      id: "notif_001",
      workspaceId: sessionContextFixture.activeWorkspace?.id ?? "ws_demo",
      userId: sessionContextFixture.actor?.id ?? null,
      type: "approval.created",
      title: "Approval requested for delivery draft",
      body: "Claim package for case A40-101/2026 is waiting for manual approval.",
      severity: "warning",
      priority: "high",
      actionUrl: "/approvals",
      entityType: "approval_task",
      entityId: "approval_001",
      metadata: {
        runId: "run_001",
      },
      readAt: null,
      createdAt: "2026-04-21T09:06:30.000Z",
    },
    {
      id: "notif_002",
      workspaceId: sessionContextFixture.activeWorkspace?.id ?? "ws_demo",
      userId: sessionContextFixture.actor?.id ?? null,
      type: "recommendation.created",
      title: "New workflow recommendation is available",
      body: "The repeated pre-trial claim path can be promoted into a reusable automation draft.",
      severity: "info",
      priority: "normal",
      actionUrl: "/recommendations",
      entityType: "recommendation",
      entityId: "rec_001",
      metadata: {
        recommendationId: "rec_001",
      },
      readAt: "2026-04-21T13:30:00.000Z",
      createdAt: "2026-04-21T12:10:30.000Z",
    },
  ];
}

function buildInitialDetail(summary: DocumentSummary): DocumentDetail {
  return {
    ...clone(summary),
    versions: summary.currentVersion ? [clone(summary.currentVersion)] : [],
    storageObjects: [],
    relations: [],
    processingJobs: [],
    availableActions: {
      canUploadVersion: true,
      canDelete: true,
      canRestore: summary.status !== "ready",
      canManageTemplate: summary.kind === "document_template",
      canRequestSignedUrl: true,
    },
  };
}

function buildInitialState(): MockState {
  const documents = new Map<string, DocumentDetail>();

  for (const item of documentsFixture.items) {
    documents.set(item.id, buildInitialDetail(item));
  }

  documents.set(documentDetailFixture.id, clone(documentDetailFixture));

  return {
    sessionContext: clone(sessionContextFixture),
    documents,
    legalSources: new Map([[legalSourceDetailFixture.id, clone(legalSourceDetailFixture)]]),
    legalImportJobs: [clone(legalImportJobFixture)],
    ragRequests: new Map([[ragRequestFixture.id, clone(ragRequestFixture)]]),
    runArtifacts: [...clone(runArtifactsFixture)],
    notifications: buildInitialNotifications(),
    members: [...clone(workspaceMembersFixture)],
    invitations: [...clone(workspaceInvitationsFixture)],
    auditEvents: [...clone(auditEventsFixture)],
  };
}

const state = buildInitialState();

function decodeDevToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer dev.")) {
    return null;
  }

  const [, token] = authorization.split(" ", 2);
  const encodedPayload = token?.slice(4);
  if (!encodedPayload) {
    return null;
  }

  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as {
      readonly id: string;
      readonly email: string;
      readonly fullName?: string;
    };

    return decoded;
  } catch {
    return null;
  }
}

function buildSessionContext(request: Request): SessionContext {
  const payload = decodeDevToken(request);
  if (!payload) {
    return clone(sessionContextFixture);
  }

  const isViewer = payload.email.includes("viewer");
  const viewerPermissions =
    roleDefinitionsFixture.find((definition) => definition.code === "viewer")
      ?.permissions ?? [];
  const role = isViewer ? "viewer" : "owner";
  const ownerSettingsPermissions = [
    "settings.view",
    "settings.profile.update_self",
    "settings.organization.view",
    "settings.organization.update",
    "settings.ai.view",
    "settings.ai.manage_self",
    "settings.ai.manage_workspace",
    "settings.ai.secret.create_self",
    "settings.ai.secret.rotate_self",
    "settings.ai.secret.create_workspace",
    "settings.ai.secret.rotate_workspace",
    "settings.ai.connection.test",
    "settings.ai.diagnostics.view",
    "settings.ai.effective_policy.view",
  ] as const;
  const viewerSettingsPermissions = [
    "settings.view",
    "settings.profile.update_self",
    "settings.organization.view",
    "settings.ai.view",
    "settings.ai.manage_self",
  ] as const;

  return {
    ...clone(sessionContextFixture),
    actor: {
      ...clone(sessionContextFixture.actor!),
      id: payload.id,
      email: payload.email,
      fullName:
        payload.fullName?.trim() ||
        payload.email.split("@")[0] ||
        sessionContextFixture.actor!.fullName,
    },
    activeWorkspace: {
      ...clone(sessionContextFixture.activeWorkspace!),
      role,
    },
    workspaces: [
      {
        ...clone(sessionContextFixture.activeWorkspace!),
        role,
      },
    ],
    roles: isViewer ? ["viewer"] : ["owner", "security_admin"],
    permissions: isViewer
      ? [...new Set([...viewerPermissions, ...viewerSettingsPermissions])]
      : [...new Set([...sessionContextFixture.permissions, ...ownerSettingsPermissions])],
  };
}

function activeWorkspaceId() {
  return state.sessionContext.activeWorkspace?.id ?? "ws_demo";
}

function activeActorId() {
  return state.sessionContext.actor?.id ?? "usr_demo";
}

let settingsProfile = {
  firstName: "Stage",
  lastName: "Owner",
  displayName: "Stage Owner",
  locale: "ru",
  timezone: "Europe/Berlin",
};

let settingsOrganization = {
  organizationDisplayName: "Pravocontour Demo",
  organizationLegalName: "Pravocontour Legal Demo LLC",
};

let aiProviderConnections: AiProviderConnectionDto[] = [
  {
    id: "pc_stage21_chat",
    workspaceId: activeWorkspaceId(),
    ownerScope: "workspace",
    ownerUserId: null,
    providerCode: "openai_compatible",
    uiLabel: "Workspace chat model",
    baseUrl: "https://api.example.com/v1",
    modelId: "stage21-chat-model",
    enabled: true,
    secret: {
      hasSecret: true,
      secretStatus: "active",
      fingerprint: "sha256:stage21chat",
      lastUpdatedAt: "2026-05-07T10:00:00.000Z",
      backend: "dev_mock",
    },
    capabilities: {
      streaming: true,
      jsonMode: true,
      structuredJsonSchema: true,
      toolCalls: true,
    },
    lastTestStatus: "success",
    lastTestedAt: "2026-05-07T10:02:00.000Z",
    lastUsedAt: null,
    createdAt: "2026-05-07T10:00:00.000Z",
    updatedAt: "2026-05-07T10:00:00.000Z",
  },
];

let aiRouteGroupPreferences: AiRouteGroupPreferenceDto[] = [
  {
    routeGroup: "chat_ai",
    scopeType: "workspace",
    workspaceId: activeWorkspaceId(),
    userId: null,
    providerConnectionId: "pc_stage21_chat",
    providerCode: "openai_compatible",
    modelId: "stage21-chat-model",
    enabled: true,
    capabilitiesConfirmed: {
      streaming: true,
      jsonMode: true,
      structuredJsonSchema: true,
      toolCalls: true,
    },
    updatedAt: "2026-05-07T10:00:00.000Z",
  },
];

function buildSettingsBootstrap(): SettingsBootstrapResponse {
  const workspace = state.sessionContext.activeWorkspace;
  return {
    profile: {
      userId: activeActorId(),
      email: state.sessionContext.actor?.email ?? "owner@lexframe.local",
      firstName: settingsProfile.firstName,
      lastName: settingsProfile.lastName,
      displayName: settingsProfile.displayName,
      fullName: settingsProfile.displayName,
      locale: settingsProfile.locale,
      timezone: settingsProfile.timezone,
    },
    organization: workspace
      ? {
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          workspaceName: workspace.name,
          organizationDisplayName: settingsOrganization.organizationDisplayName,
          organizationLegalName: settingsOrganization.organizationLegalName,
          status: workspace.status,
          role: workspace.role,
          canEditDisplayFields: state.sessionContext.permissions.includes(
            "settings.organization.update",
          ),
        }
      : null,
    permissions: state.sessionContext.permissions,
    tabs: ["profile", "organization", "ai", "diagnostics"],
  };
}

function buildAiSettings(): AiSettingsResponse {
  return {
    providerConnections: aiProviderConnections,
    routeGroups: aiRouteGroupPreferences,
    effectivePolicies: [
      {
        routeGroup: "chat_ai",
        routeCode: "default_chat",
        source: "workspace_preference",
        providerConnectionId: "pc_stage21_chat",
        providerCode: "openai_compatible",
        modelId: "stage21-chat-model",
        baseUrl: "https://api.example.com/v1",
        hasSecret: true,
        secretStatus: "active",
        fingerprint: "sha256:stage21chat",
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: "stage21-chat-policy",
        resolvedAt: "2026-05-07T10:03:00.000Z",
      },
      {
        routeGroup: "automation_ai",
        routeCode: "automation_planner_high",
        source: "stage18_default_route",
        providerConnectionId: "stage20_reserved_owner_route",
        providerCode: "openai",
        modelId: "gpt-5.5",
        baseUrl: null,
        hasSecret: false,
        secretStatus: "missing",
        fingerprint: null,
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: "stage21-automation-policy",
        resolvedAt: "2026-05-07T10:03:00.000Z",
      },
    ],
  };
}

function buildSystemStatus(): SystemStatusSummary {
  const checkedAt = new Date().toISOString();
  const components = [
    {
      code: "storage",
      label: "storage",
      status: "healthy" as const,
      summary: "Mock PostgreSQL and storage contract are available.",
      checkedAt,
    },
    {
      code: "activepieces",
      label: "activepieces",
      status: "healthy" as const,
      summary: "Builder token issuance and runtime sync fixtures are available.",
      checkedAt,
    },
    {
      code: "ai",
      label: "ai",
      status: "healthy" as const,
      summary: "AI gateway fixtures expose planner and redaction routes.",
      checkedAt,
    },
    {
      code: "search",
      label: "search",
      status: "healthy" as const,
      summary: "Search and RAG fixtures are available for smoke tests.",
      checkedAt,
    },
    {
      code: "realtime",
      label: "realtime",
      status: "degraded" as const,
      summary: "Realtime transport is simulated during preview smoke tests.",
      checkedAt,
    },
  ];

  return {
    overall: "degraded",
    summary:
      "Runtime status keeps AI, storage, Activepieces, search and realtime dependencies visible for degraded-mode UX.",
    checkedAt,
    incidentsOpen: 0,
    components,
  };
}

function listNotificationsResponse(url: URL): NotificationListResponse {
  const actorId = activeActorId();
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") ?? "25") || 25),
  );
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status") ?? "all";
  const type = url.searchParams.get("type");
  const allItems = [...state.notifications]
    .filter((item) => item.workspaceId === activeWorkspaceId())
    .filter((item) => item.userId === actorId || item.userId === null)
    .filter((item) =>
      status === "unread"
        ? item.readAt === null
        : status === "read"
          ? item.readAt !== null
          : true,
    )
    .filter((item) => (type ? item.type === type : true))
    .filter((item) => (cursor ? item.createdAt < cursor : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const pageItems = allItems.slice(0, limit);

  return {
    items: pageItems,
    nextCursor: allItems.length > limit ? pageItems.at(-1)?.createdAt ?? null : null,
    unreadCount: state.notifications.filter(
      (item) =>
        item.workspaceId === activeWorkspaceId() &&
        (item.userId === actorId || item.userId === null) &&
        item.readAt === null,
    ).length,
  };
}

function buildDashboardSnapshot(): DashboardSnapshot {
  const activeRuns = runsFixture.filter((run) =>
    [
      "queued",
      "created",
      "precheck_failed",
      "ready_to_start",
      "starting",
      "running",
      "waiting_approval",
      "waiting_delivery_approval",
      "delivering",
      "retrying",
    ].includes(run.status),
  );
  const failedRuns = runsFixture.filter((run) => run.status === "failed");
  const notifications = listNotificationsResponse(
    new URL("http://127.0.0.1/notifications"),
  );

  return {
    snapshotVersion: 42,
    generatedAt: new Date().toISOString(),
    activeRuns: activeRuns.slice(0, 6),
    failedRuns: failedRuns.slice(0, 6),
    pendingApprovals: approvalTasksFixture.filter((item) => item.status === "pending"),
    recentArtifacts: [...state.runArtifacts].slice(0, 8),
    recommendations: recommendationsFixture.slice(0, 6),
    unreadNotificationsCount: notifications.unreadCount,
    systemStatus: buildSystemStatus(),
  };
}

function buildDashboardEvents(url: URL): DashboardEventListResponse {
  const sinceSequence = Number(url.searchParams.get("since_sequence") ?? "0") || 0;
  const items = [
    {
      id: "evt_041",
      sequenceId: 41,
      topic: `workspace:${activeWorkspaceId()}:dashboard`,
      eventType: "run.step.updated",
      entityType: "workflow_run",
      entityId: "run_001",
      payload: {
        runId: "run_001",
        stepCode: "delivery-draft",
      },
      createdAt: "2026-04-21T09:05:30.000Z",
    },
    {
      id: "evt_042",
      sequenceId: 42,
      topic: `user:${activeActorId()}:notifications`,
      eventType: "notification.created",
      entityType: "notification",
      entityId: "notif_001",
      payload: {
        notificationId: "notif_001",
      },
      createdAt: "2026-04-21T09:06:30.000Z",
    },
  ].filter((item) => item.sequenceId > sinceSequence);

  return {
    snapshotVersion: 42,
    events: items,
    nextSequence: null,
  };
}

function buildRunLiveSnapshot(runId: string): RunLiveSnapshot | null {
  const run = runsFixture.find((item) => item.id === runId);

  if (!run) {
    return null;
  }

  const primaryApprovalTask = approvalTasksFixture[0]!;
  const approvalTasks =
    runId === "run_001"
      ? [
          {
            ...primaryApprovalTask,
            kind: "delivery_approval" as const,
            deliveryRequestId: "delivery_001",
            requestedChangesCount: 0,
            expiresAt: "2026-04-21T18:00:00.000Z",
            metadata: {
              requiresApproval: true,
            },
          },
        ]
      : [];
  const deliveryRequests =
    runId === "run_001"
      ? [
          {
            id: "delivery_001",
            workflowRunId: "run_001",
            approvalTaskId: "approval_001",
            channel: "email" as const,
            title: "Email delivery draft for case A40-101/2026",
            status: "waiting_approval" as const,
            recipientEmails: ["client@lexframe.local"],
            attachmentArtifactIds: ["rart_01"],
            contentHash: "hash_delivery_001",
            requiresApproval: true,
            approvedAt: null,
            sentAt: null,
            lastErrorCode: null,
            createdAt: "2026-04-21T09:05:00.000Z",
            updatedAt: "2026-04-21T09:06:00.000Z",
          },
        ]
      : [];

  return {
    id: run.id,
    automationId: run.automationId,
    title: run.title,
    status: run.status,
    traceId: run.traceId,
    externalRunId: run.externalRunId,
    currentStep: run.currentStep,
    progressPercent: run.progressPercent,
    approvalState: run.approvalState,
    errorCode: run.errorCode,
    errorMessage: null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    allowedActions:
      run.status === "waiting_approval"
        ? ["cancel", "retry_step", "open_artifact"]
        : ["open_artifact"],
    inputs: {
      profileId: "profile_stage7_001",
      documentIds: ["doc_01hzstage2claim"],
      params: {
        caseNumber: "A40-101/2026",
      },
    },
    steps: run.stepStatus.map((step, index) => ({
      id: `run-step-${run.id}-${index + 1}`,
      stepCode: step.stepCode,
      moduleCode: step.moduleCode,
      status: step.status,
      requiresApproval: step.requiresApproval,
      outputs: {},
      errorCode: step.errorCode,
      errorMessage: null,
      attemptCount: 1,
      startedAt: run.startedAt,
      finishedAt: step.status === "completed" ? run.startedAt : null,
      lastEventAt: run.finishedAt ?? run.startedAt,
    })),
    artifacts: state.runArtifacts.filter((artifact) => artifact.workflowRunId === run.id),
    approvalTasks,
    deliveryRequests,
    snapshotVersion: 42,
    liveTopics: [`workspace:${activeWorkspaceId()}:dashboard`, `run:${run.id}`],
  };
}

function toSummary(detail: DocumentDetail): DocumentSummary {
  return {
    id: detail.id,
    workspaceId: detail.workspaceId,
    ownerId: detail.ownerId,
    title: detail.title,
    description: detail.description,
    kind: detail.kind,
    status: detail.status,
    classification: detail.classification,
    source: detail.source,
    tags: detail.tags,
    currentVersion: detail.currentVersion,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    archivedAt: detail.archivedAt,
    deletedAt: detail.deletedAt,
  };
}

function toLegalSummary(detail: LegalSourceDetail): LegalSourceSummary {
  return {
    id: detail.id,
    workspaceId: detail.workspaceId,
    documentId: detail.documentId,
    provider: detail.provider,
    sourceType: detail.sourceType,
    jurisdiction: detail.jurisdiction,
    title: detail.title,
    canonicalUrl: detail.canonicalUrl,
    externalId: detail.externalId,
    licenseStatus: detail.licenseStatus,
    visibility: detail.visibility,
    classification: detail.classification,
    status: detail.status,
    ownerWorkspaceId: detail.ownerWorkspaceId,
    ownerUserId: detail.ownerUserId,
    court: detail.court,
    caseNumber: detail.caseNumber,
    decisionDate: detail.decisionDate,
    hasEmbeddings: detail.hasEmbeddings,
    indexedAt: detail.indexedAt,
    lastUsedAt: detail.lastUsedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function sortVersions(versions: readonly DocumentVersionSummary[]) {
  return [...versions].sort((left, right) => right.versionNo - left.versionNo);
}

function appendAudit(
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  state.auditEvents = [
    {
      id: `audit_${Date.now()}`,
      occurredAt: new Date().toISOString(),
      actorUserId: state.sessionContext.actor?.id ?? null,
      actorEmail: state.sessionContext.actor?.email ?? null,
      workspaceId: activeWorkspaceId(),
      action,
      entityType,
      entityId,
      eventCategory: "general",
      sessionId: "sess_msw_demo",
      dataClass: null,
      result: "success",
      reasonCode: null,
      requestId: "req_msw",
      traceId: "trace_msw",
      metadata,
    },
    ...state.auditEvents,
  ];
}

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf(".");
  const baseName = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const extension = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";
  const safeBase = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeExtension = extension.replace(/[^a-z0-9]+/g, "");
  return safeExtension
    ? `${safeBase || "document"}.${safeExtension}`
    : safeBase || "document";
}

function buildStoragePath(
  documentId: string,
  versionId: string,
  role: DocumentObjectRole,
  filename: string,
) {
  return `workspace/${activeWorkspaceId()}/documents/${documentId}/versions/${versionId}/${role}/${sanitizeFilename(filename)}`;
}

function deriveSource(kind: DocumentKind) {
  return kind === "document_template" ? "template_library" : "user_upload";
}

function buildSignedUrl(
  documentId: string,
  versionId: string,
  objectRole: DocumentObjectRole,
  expiresInSeconds: number,
) {
  const expiresAt = new Date(
    Date.now() + expiresInSeconds * 1000,
  ).toISOString();

  return {
    documentId,
    versionId,
    objectRole,
    signedUrl: `http://127.0.0.1:54321/storage/v1/object/sign/mock/${documentId}/${versionId}/${objectRole}?token=${Date.now()}`,
    expiresAt,
  };
}

function buildVersion(
  documentId: string,
  versionId: string,
  versionNo: number,
  filename: string,
  mimeType: string,
  sizeBytes: number,
): DocumentVersionSummary {
  return {
    id: versionId,
    documentId,
    versionNo,
    status: "upload_pending",
    originalFilename: filename,
    mimeType,
    sizeBytes,
    sha256: null,
    storageState: "private_bucket",
    scanStatus: "not_started",
    previewStatus: "not_started",
    extractionStatus: "not_started",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

function finalizeVersion(
  detail: DocumentDetail,
  versionId: string,
  input: CompleteUploadRequest,
): DocumentDetail {
  const completedAt = new Date().toISOString();
  const previewReady =
    input.clientReportedMimeType === "application/pdf" ||
    input.clientReportedMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const extractionReady =
    previewReady || input.clientReportedMimeType === "text/plain";

  const versions = detail.versions.map((version) =>
    version.id === versionId
      ? {
          ...version,
          status: "ready" as DocumentStatus,
          sizeBytes: input.clientReportedSize,
          mimeType: input.clientReportedMimeType,
          sha256: input.sha256 ?? null,
          scanStatus: "clean" as const,
          previewStatus: previewReady
            ? ("ready" as const)
            : ("failed" as const),
          extractionStatus: extractionReady
            ? ("ready" as const)
            : ("failed" as const),
          completedAt,
        }
      : version,
  );

  const currentVersion =
    versions.find((version) => version.id === versionId) ?? null;

  if (!currentVersion) {
    return detail;
  }

  const nextStorageObjects = [
    ...detail.storageObjects.filter((object) => object.versionId !== versionId),
    {
      id: `dso_${versionId}_original`,
      versionId,
      role: "original" as const,
      mimeType: input.clientReportedMimeType,
      sizeBytes: input.clientReportedSize,
      status: "private_bucket" as const,
      createdAt: completedAt,
    },
    ...(previewReady
      ? [
          {
            id: `dso_${versionId}_preview`,
            versionId,
            role: "preview_pdf" as const,
            mimeType: "application/pdf",
            sizeBytes: Math.round(input.clientReportedSize * 0.45),
            status: "signed_url_only" as const,
            createdAt: completedAt,
          },
        ]
      : []),
    ...(extractionReady
      ? [
          {
            id: `dso_${versionId}_text`,
            versionId,
            role: "extracted_text" as const,
            mimeType: "application/json",
            sizeBytes: 2048,
            status: "private_bucket" as const,
            createdAt: completedAt,
          },
        ]
      : []),
  ];

  const nextJobs = [
    ...detail.processingJobs.filter((job) => job.versionId !== versionId),
    {
      id: `job_${versionId}_scan`,
      versionId,
      jobType: "virus_scan" as const,
      status: "completed" as const,
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      createdAt: completedAt,
      updatedAt: completedAt,
    },
    {
      id: `job_${versionId}_meta`,
      versionId,
      jobType: "metadata_extract" as const,
      status: "completed" as const,
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      createdAt: completedAt,
      updatedAt: completedAt,
    },
    {
      id: `job_${versionId}_text`,
      versionId,
      jobType: "text_extract" as const,
      status: extractionReady ? ("completed" as const) : ("skipped" as const),
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      createdAt: completedAt,
      updatedAt: completedAt,
    },
    {
      id: `job_${versionId}_preview`,
      versionId,
      jobType: "preview_generate" as const,
      status: previewReady ? ("completed" as const) : ("skipped" as const),
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      createdAt: completedAt,
      updatedAt: completedAt,
    },
    {
      id: `job_${versionId}_index`,
      versionId,
      jobType: "index_prepare" as const,
      status: "completed" as const,
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      createdAt: completedAt,
      updatedAt: completedAt,
    },
  ];

  return {
    ...detail,
    status: "ready",
    currentVersion,
    updatedAt: completedAt,
    versions: sortVersions(versions),
    storageObjects: nextStorageObjects,
    processingJobs: nextJobs,
  };
}

function getDocumentOrResponse(documentId: string) {
  const detail = state.documents.get(documentId);

  if (!detail) {
    return HttpResponse.json(
      {
        error: {
          code: "DOCUMENT_NOT_FOUND",
          message: "Document not found.",
        },
        path: `/documents/${documentId}`,
        requestId: "req_msw",
      },
      { status: 404 },
    );
  }

  return detail;
}

function filterDocuments(query: DocumentListQuery) {
  return [...state.documents.values()]
    .filter((detail) =>
      query.status === "soft_deleted"
        ? detail.deletedAt !== null
        : detail.deletedAt === null,
    )
    .filter((detail) => (query.kind ? detail.kind === query.kind : true))
    .filter((detail) => (query.status ? detail.status === query.status : true))
    .filter((detail) =>
      query.classification
        ? detail.classification === query.classification
        : true,
    )
    .filter((detail) => (query.tag ? detail.tags.includes(query.tag) : true))
    .filter((detail) => {
      if (!query.q) {
        return true;
      }

      const value = query.q.toLowerCase();
      return (
        detail.title.toLowerCase().includes(value) ||
        (detail.description ?? "").toLowerCase().includes(value)
      );
    })
    .map((detail) => toSummary(detail))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function filterLegalSearch(query: LegalSearchQuery): LegalSearchResponse {
  const items = [...state.legalSources.values()].map((detail) => toLegalSummary(detail));
  const selectedSourceIds = new Set(query.selectedSourceIds ?? []);
  const normalizedQuery = query.query.toLowerCase().trim();
  const filteredItems = items.filter((item) =>
    selectedSourceIds.size > 0 ? selectedSourceIds.has(item.id) : true,
  );
  const source =
    filteredItems.find((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${item.title} ${item.caseNumber ?? ""} ${item.court ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    }) ?? filteredItems[0] ?? legalSourceSummaryFixture;
  const detail = state.legalSources.get(source.id) ?? legalSourceDetailFixture;
  const chunk = detail.chunks[0] ?? legalSourceDetailFixture.chunks[0]!;
  const snippet =
    normalizedQuery.length > 0
      ? chunk.text.slice(0, 220)
      : legalSearchResponseFixture.results[0]!.snippet;

  return {
    ...legalSearchResponseFixture,
    mode: query.mode,
    total: source ? 1 : 0,
    results: source
      ? [
          {
            ...legalSearchResponseFixture.results[0]!,
            source,
            chunk,
            snippet,
            citation: {
              ...legalSearchResponseFixture.results[0]!.citation,
              sourceId: source.id,
              chunkId: chunk.id,
              documentVersionId: chunk.documentVersionId,
              title: source.title,
              pageFrom: chunk.pageFrom,
              pageTo: chunk.pageTo,
              court: source.court,
              caseNumber: source.caseNumber,
              decisionDate: source.decisionDate,
            },
          },
        ]
      : [],
  };
}

export const handlers = [
  http.post("*/auth/bootstrap", () =>
    HttpResponse.json({
      status: "ok",
    }),
  ),

  http.get("*/session/context", ({ request }) =>
    HttpResponse.json(buildSessionContext(request)),
  ),

  http.get("*/settings/bootstrap", () =>
    HttpResponse.json(buildSettingsBootstrap()),
  ),

  http.patch("*/settings/profile", async ({ request }) => {
    const payload = (await request.json()) as Partial<typeof settingsProfile>;
    settingsProfile = {
      ...settingsProfile,
      ...(typeof payload.firstName === "string"
        ? { firstName: payload.firstName }
        : {}),
      ...(typeof payload.lastName === "string"
        ? { lastName: payload.lastName }
        : {}),
      ...(typeof payload.displayName === "string"
        ? { displayName: payload.displayName }
        : {}),
      ...(typeof payload.locale === "string" ? { locale: payload.locale } : {}),
      ...(typeof payload.timezone === "string"
        ? { timezone: payload.timezone }
        : {}),
    };
    return HttpResponse.json(buildSettingsBootstrap().profile);
  }),

  http.patch("*/settings/organization", async ({ request }) => {
    const payload = (await request.json()) as Partial<
      typeof settingsOrganization
    >;
    settingsOrganization = {
      ...settingsOrganization,
      ...(typeof payload.organizationDisplayName === "string"
        ? { organizationDisplayName: payload.organizationDisplayName }
        : {}),
      ...(typeof payload.organizationLegalName === "string"
        ? { organizationLegalName: payload.organizationLegalName }
        : {}),
    };
    return HttpResponse.json(buildSettingsBootstrap().organization);
  }),

  http.get("*/settings/ai", () => HttpResponse.json(buildAiSettings())),

  http.post("*/settings/ai/provider-connections", async ({ request }) => {
    const payload = (await request.json()) as CreateAiProviderConnectionRequest;
    const connection: AiProviderConnectionDto = {
      id: `pc_stage21_${Date.now()}`,
      workspaceId: activeWorkspaceId(),
      ownerScope: payload.ownerScope ?? "user",
      ownerUserId: payload.ownerScope === "workspace" ? null : activeActorId(),
      providerCode: payload.providerCode,
      uiLabel: payload.uiLabel ?? `${payload.providerCode} ${payload.modelId}`,
      baseUrl: payload.baseUrl,
      modelId: payload.modelId,
      enabled: true,
      secret: {
        hasSecret: Boolean(payload.apiKey),
        secretStatus: payload.apiKey ? "active" : "missing",
        fingerprint: payload.apiKey ? "sha256:mockfingerprint" : null,
        lastUpdatedAt: payload.apiKey ? new Date().toISOString() : null,
        backend: payload.apiKey ? "dev_mock" : null,
      },
      capabilities: payload.capabilities ?? {},
      lastTestStatus: "not_tested",
      lastTestedAt: null,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    aiProviderConnections = [connection, ...aiProviderConnections];
    return HttpResponse.json(connection, { status: 201 });
  }),

  http.patch("*/settings/ai/provider-connections/:id", async ({
    params,
    request,
  }) => {
    const id = String(params.id);
    const payload = (await request.json()) as UpdateAiProviderConnectionRequest;
    aiProviderConnections = aiProviderConnections.map((connection) =>
      connection.id === id
        ? {
            ...connection,
            providerCode: payload.providerCode ?? connection.providerCode,
            uiLabel: payload.uiLabel ?? connection.uiLabel,
            baseUrl: payload.baseUrl ?? connection.baseUrl,
            modelId: payload.modelId ?? connection.modelId,
            enabled: payload.enabled ?? connection.enabled,
            capabilities: payload.capabilities ?? connection.capabilities,
            updatedAt: new Date().toISOString(),
          }
        : connection,
    );
    return HttpResponse.json(
      aiProviderConnections.find((connection) => connection.id === id),
    );
  }),

  http.post("*/settings/ai/provider-connections/:id/secret", ({ params }) => {
    const id = String(params.id);
    aiProviderConnections = aiProviderConnections.map((connection) =>
      connection.id === id
        ? {
            ...connection,
            secret: {
              hasSecret: true,
              secretStatus: "active",
              fingerprint: "sha256:rotatedmock",
              lastUpdatedAt: new Date().toISOString(),
              backend: "dev_mock",
            },
          }
        : connection,
    );
    return HttpResponse.json(
      aiProviderConnections.find((connection) => connection.id === id),
    );
  }),

  http.post("*/settings/ai/provider-connections/:id/test", ({ params }) => {
    const id = String(params.id);
    const result = {
      providerConnectionId: id,
      status: "success",
      latencyMs: 12,
      testedAt: new Date().toISOString(),
      errorCode: null,
      message: "Backend health check completed without sending user prompts.",
      redacted: true,
    } as const;
    aiProviderConnections = aiProviderConnections.map((connection) =>
      connection.id === id
        ? {
            ...connection,
            lastTestStatus: "success",
            lastTestedAt: result.testedAt,
          }
        : connection,
    );
    return HttpResponse.json(result);
  }),

  http.patch("*/settings/ai/route-groups/:routeGroup", async ({
    params,
    request,
  }) => {
    const routeGroup = String(params.routeGroup) as AiRouteGroupPreferenceDto["routeGroup"];
    const payload = (await request.json()) as UpdateAiRouteGroupPreferenceRequest;
    const connection = aiProviderConnections.find(
      (item) => item.id === payload.providerConnectionId,
    );
    const preference: AiRouteGroupPreferenceDto = {
      routeGroup,
      scopeType: payload.scopeType,
      workspaceId: activeWorkspaceId(),
      userId: payload.scopeType === "user" ? activeActorId() : null,
      providerConnectionId: payload.providerConnectionId,
      providerCode: connection?.providerCode ?? null,
      modelId: payload.modelId ?? connection?.modelId ?? null,
      enabled: payload.enabled ?? true,
      capabilitiesConfirmed: payload.capabilitiesConfirmed ?? {},
      updatedAt: new Date().toISOString(),
    };
    aiRouteGroupPreferences = [
      preference,
      ...aiRouteGroupPreferences.filter(
        (item) =>
          item.routeGroup !== preference.routeGroup ||
          item.scopeType !== preference.scopeType,
      ),
    ];
    return HttpResponse.json(preference);
  }),

  http.get("*/settings/ai/effective-policy", () =>
    HttpResponse.json({ policies: buildAiSettings().effectivePolicies }),
  ),

  ...stage15Handlers,

  http.post("*/workspaces/:workspaceId/switch", ({ params }) => {
    const workspaceId = String(params.workspaceId);
    const workspace =
      state.sessionContext.workspaces.find((item) => item.id === workspaceId) ??
      null;

    if (!workspace) {
      return HttpResponse.json(
        {
          error: {
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace not found.",
          },
          path: `/workspaces/${workspaceId}/switch`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    state.sessionContext = {
      ...state.sessionContext,
      activeWorkspace: workspace,
    };

    return HttpResponse.json(state.sessionContext);
  }),

  http.get("*/library", () => HttpResponse.json(libraryTemplatesFixture)),
  http.get("*/legal-modules", () => HttpResponse.json(legalModulesFixture)),
  http.get("*/legal-modules/:code", ({ params }) => {
    const code = String(params.code);
    const summary = legalModulesFixture.find((item) => item.code === code);

    if (!summary) {
      return HttpResponse.json(
        {
          error: {
            code: "MODULE_NOT_FOUND",
            message: "Legal module not found.",
          },
          path: `/legal-modules/${code}`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      ...legalModuleDetailFixture,
      ...summary,
    });
  }),
  http.get("*/legal-sources", () =>
    HttpResponse.json([...state.legalSources.values()].map((detail) => toLegalSummary(detail))),
  ),
  http.get("*/legal-sources/:sourceId", ({ params }) => {
    const sourceId = String(params.sourceId);
    const detail = state.legalSources.get(sourceId) ?? null;

    if (!detail) {
      return HttpResponse.json(
        {
          error: {
            code: "LEGAL_SOURCE_NOT_FOUND",
            message: "Legal source not found.",
          },
          path: `/legal-sources/${sourceId}`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json(detail);
  }),
  http.post("*/legal-sources/import-jobs", async ({ request }) => {
    const payload = (await request.json()) as {
      readonly documentId?: string;
      readonly documentType?: LegalSourceDetail["sourceType"];
      readonly classification?: LegalSourceDetail["classification"];
      readonly metadata?: Record<string, unknown>;
    };
    const importId = `limport_${Date.now()}`;
    const sourceId = `lsrc_${Date.now()}`;
    const chunkId = `lchk_${Date.now()}`;
    const detail: LegalSourceDetail = {
      ...clone(legalSourceDetailFixture),
      id: sourceId,
      documentId: payload.documentId ?? legalSourceDetailFixture.documentId,
      sourceType: payload.documentType ?? legalSourceDetailFixture.sourceType,
      classification:
        payload.classification ?? legalSourceDetailFixture.classification,
      title:
        typeof payload.metadata?.title === "string"
          ? payload.metadata.title
          : legalSourceDetailFixture.title,
      caseNumber:
        typeof payload.metadata?.caseNumber === "string"
          ? payload.metadata.caseNumber
          : legalSourceDetailFixture.caseNumber,
      status: "indexed",
      updatedAt: new Date().toISOString(),
      importJobs: [
        {
          ...clone(legalImportJobFixture),
          id: importId,
          sourceId,
          documentId: payload.documentId ?? legalSourceDetailFixture.documentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        },
      ],
      chunks: [
        {
          ...clone(legalSourceDetailFixture.chunks[0]!),
          id: chunkId,
          sourceId,
        },
      ],
      metadata: {
        ...clone(legalSourceDetailFixture.metadata),
        ...(payload.metadata ?? {}),
      },
    };
    const job: LegalImportJob = {
      ...clone(legalImportJobFixture),
      id: importId,
      sourceId,
      documentId: payload.documentId ?? legalSourceDetailFixture.documentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    state.legalSources.set(sourceId, detail);
    state.legalImportJobs = [job, ...state.legalImportJobs];
    appendAudit("legal.source.imported", "legal_source", sourceId, {
      importJobId: importId,
    });

    return HttpResponse.json(job);
  }),
  http.get("*/legal-import-jobs/:jobId", ({ params }) => {
    const jobId = String(params.jobId);
    const job = state.legalImportJobs.find((item) => item.id === jobId) ?? null;

    if (!job) {
      return HttpResponse.json(
        {
          error: {
            code: "LEGAL_IMPORT_JOB_NOT_FOUND",
            message: "Legal import job not found.",
          },
          path: `/legal-import-jobs/${jobId}`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json(job);
  }),
  http.post("*/legal-search/query", async ({ request }) =>
    HttpResponse.json(filterLegalSearch((await request.json()) as LegalSearchQuery)),
  ),
  http.post("*/workflow-runtime/legal-search/execute", async ({ request }) =>
    HttpResponse.json(filterLegalSearch((await request.json()) as LegalSearchQuery)),
  ),
  http.post("*/legal-rag/analyze", async ({ request }) => {
    const payload = (await request.json()) as {
      readonly question?: string;
      readonly sourceSelection?: {
        readonly selectedSourceIds?: readonly string[];
      };
    };
    const requestId = `rag_${Date.now()}`;
    const result: RagRequestSummary = {
      ...clone(ragRequestFixture),
      id: requestId,
      question: payload.question ?? ragRequestFixture.question,
      selectedSourceIds:
        payload.sourceSelection?.selectedSourceIds ?? ragRequestFixture.selectedSourceIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      output: {
        ...clone(legalAnalysisOutputFixture),
        summary: payload.question
          ? `Собран анализ по вопросу: ${payload.question}`
          : legalAnalysisOutputFixture.summary,
      },
    };
    state.ragRequests.set(requestId, result);
    appendAudit("legal.rag.completed", "rag_request", requestId, {
      selectedSourceIds: result.selectedSourceIds,
    });

    return HttpResponse.json(result);
  }),
  http.post("*/workflow-runtime/legal-rag/analyze", async ({ request }) =>
    HttpResponse.json(
      {
        ...clone(ragRequestFixture),
        id: `rag_${Date.now()}`,
        question:
          ((await request.json()) as { readonly question?: string }).question ??
          ragRequestFixture.question,
      },
    ),
  ),
  http.get("*/legal-rag/requests/:requestId", ({ params }) => {
    const requestId = String(params.requestId);
    const item = state.ragRequests.get(requestId) ?? null;

    if (!item) {
      return HttpResponse.json(
        {
          error: {
            code: "RAG_REQUEST_NOT_FOUND",
            message: "RAG request not found.",
          },
          path: `/legal-rag/requests/${requestId}`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json(item);
  }),
  http.post("*/legal-modules/validate-step", () =>
    HttpResponse.json({
      ok: true,
      issues: [],
    }),
  ),
  http.get("*/automation-templates", ({ request }) => {
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "true";
    const scope = url.searchParams.get("scope");
    const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";

    return HttpResponse.json(
      libraryTemplatesFixture.filter((template) => {
        if (mine && !["workspace", "private"].includes(template.scope)) {
          return false;
        }

        if (scope && template.scope !== scope) {
          return false;
        }

        if (!q) {
          return true;
        }

        return `${template.title} ${template.code} ${template.category} ${template.description}`
          .toLowerCase()
          .includes(q);
      }),
    );
  }),
  http.get("*/automation-templates/:id", ({ params }) => {
    const id = String(params.id);
    const summary = libraryTemplatesFixture.find((item) => item.id === id);

    if (!summary) {
      return HttpResponse.json(
        {
          error: {
            code: "TEMPLATE_NOT_FOUND",
            message: "Automation template not found.",
          },
          path: `/automation-templates/${id}`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      ...automationTemplateDetailFixture,
      ...summary,
    });
  }),
  http.post("*/automation-templates", () =>
    HttpResponse.json(automationTemplateDetailFixture),
  ),
  http.patch("*/automation-templates/:id", async ({ params, request }) =>
    HttpResponse.json({
      ...automationTemplateDetailFixture,
      id: String(params.id),
      ...((await request.json()) as Record<string, unknown>),
    }),
  ),
  http.post("*/automation-templates/:id/versions", async ({ request }) =>
    HttpResponse.json({
      ...automationTemplateVersionsFixture[0],
      ...((await request.json()) as Record<string, unknown>),
      id: "tpv_new_mock",
      createdAt: new Date().toISOString(),
      publishedAt: null,
      status: "draft",
    }),
  ),
  http.post("*/automation-template-versions/:id/validate", () =>
    HttpResponse.json({
      ok: true,
      issues: [],
    }),
  ),
  http.post("*/automation-template-versions/:id/publish-draft", ({ params }) =>
    HttpResponse.json({
      ...automationTemplateDetailFixture,
      sourceTemplateVersionId: String(params.id),
    }),
  ),
  http.post("*/automation-templates/:id/install", ({ params }) =>
    HttpResponse.json({
      ...installedAutomationFixture,
      templateId: String(params.id),
    }),
  ),
  http.post("*/automation-templates/:id/fork", ({ params }) =>
    HttpResponse.json({
      ...automationTemplateDetailFixture,
      id: `fork_${String(params.id)}`,
      scope: "workspace",
      owner: "workspace",
    }),
  ),
  http.get("*/automation-templates/:id/related", ({ params }) =>
    HttpResponse.json(
      libraryTemplatesFixture.filter((item) => item.id !== String(params.id)).slice(0, 2),
    ),
  ),
  http.post("*/automation-templates/:id/submit-publication", ({ params }) =>
    HttpResponse.json({
      ...publicationRequestsFixture[0],
      templateId: String(params.id),
      status: "submitted",
      submittedAt: new Date().toISOString(),
    }),
  ),
  http.get("*/automations", () => HttpResponse.json([installedAutomationFixture])),
  http.get("*/automations/:id", () =>
    HttpResponse.json(installedAutomationFixture),
  ),
  http.post("*/installed-automations/:id/fork-to-template", ({ params }) =>
    HttpResponse.json({
      ...automationTemplateDetailFixture,
      id: `installed_fork_${String(params.id)}`,
      scope: "workspace",
      owner: "workspace",
    }),
  ),
  http.get("*/installed-automations/:id/source-diff", () =>
    HttpResponse.json(installedAutomationSourceDiffFixture),
  ),
  http.post("*/installed-automations/:id/apply-source-update", async ({ request }) => {
    const payload = (await request.json()) as {
      readonly targetTemplateVersionId?: string;
    };

    return HttpResponse.json({
      ...installedAutomationFixture,
      sourceTemplateVersionId:
        payload.targetTemplateVersionId ?? installedAutomationFixture.sourceTemplateVersionId,
    });
  }),
  http.get("*/publication-requests/:id", ({ params }) => {
    const requestItem = publicationRequestsFixture.find(
      (item) => item.id === String(params.id),
    );

    return HttpResponse.json(requestItem ?? publicationRequestsFixture[0]);
  }),
  http.get("*/moderation/publication-requests", () =>
    HttpResponse.json(publicationRequestsFixture),
  ),
  http.get("*/moderation/publication-requests/:id", ({ params }) => {
    const requestItem = publicationRequestsFixture.find(
      (item) => item.id === String(params.id),
    );

    return HttpResponse.json(requestItem ?? publicationRequestsFixture[0]);
  }),
  http.post("*/moderation/publication-requests/:id/:decision", async ({ params, request }) =>
    HttpResponse.json({
      ...(publicationRequestsFixture.find((item) => item.id === String(params.id)) ??
        publicationRequestsFixture[0]),
      status:
        String(params.decision) === "approve"
          ? "approved"
          : String(params.decision) === "reject"
            ? "rejected"
            : "changes_requested",
      reviewNote: ((await request.json()) as { readonly note?: string }).note ?? null,
      reviewedAt: new Date().toISOString(),
    }),
  ),
  http.get("*/runs", () => HttpResponse.json(runsFixture)),
  http.get("*/runs/:runId/live-snapshot", ({ params }) => {
    const snapshot = buildRunLiveSnapshot(String(params.runId));

    if (!snapshot) {
      return HttpResponse.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: "Run not found.",
          },
          path: `/runs/${params.runId}/live-snapshot`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json(snapshot);
  }),
  http.get("*/dashboard/snapshot", ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    return HttpResponse.json(
      projectId ? buildStage15ProjectSnapshot(projectId) : buildDashboardSnapshot(),
    );
  }),
  http.get("*/dashboard/events", ({ request }) =>
    HttpResponse.json(buildDashboardEvents(new URL(request.url))),
  ),
  http.get("*/system/status", () => HttpResponse.json(buildSystemStatus())),
  http.get("*/notifications", ({ request }) =>
    HttpResponse.json(listNotificationsResponse(new URL(request.url))),
  ),
  http.post("*/notifications/:id/read", ({ params }) => {
    const notificationId = String(params.id);
    const existing = state.notifications.find((item) => item.id === notificationId) ?? null;

    if (!existing) {
      return HttpResponse.json(
        {
          error: {
            code: "NOTIFICATION_NOT_FOUND",
            message: "Notification not found.",
          },
          path: `/notifications/${notificationId}/read`,
          requestId: "req_msw",
        },
        { status: 404 },
      );
    }

    const readAt = existing.readAt ?? new Date().toISOString();
    state.notifications = state.notifications.map((item) =>
      item.id === notificationId ? { ...item, readAt } : item,
    );

    return HttpResponse.json(
      state.notifications.find((item) => item.id === notificationId) ?? existing,
    );
  }),
  http.post("*/notifications/read-all", () => {
    const readAt = new Date().toISOString();
    let updatedCount = 0;

    state.notifications = state.notifications.map((item) => {
      if (item.readAt !== null) {
        return item;
      }

      updatedCount += 1;
      return {
        ...item,
        readAt,
      };
    });

    return HttpResponse.json({
      status: "ok",
      updatedCount,
    });
  }),
  http.post("*/devices/register", async ({ request }) => {
    const payload = (await request.json()) as {
      readonly deviceType?: "web_push" | "ios" | "android";
      readonly deviceToken?: string;
      readonly metadata?: Record<string, unknown>;
    };

    return HttpResponse.json({
      id: `device_${Date.now()}`,
      deviceType: payload.deviceType ?? "web_push",
      deviceToken: payload.deviceToken ?? "mock-device-token",
      metadata: payload.metadata ?? {},
      lastRegisteredAt: new Date().toISOString(),
    });
  }),
  http.delete("*/devices/:id", () =>
    HttpResponse.json({
      status: "removed",
    }),
  ),
  http.get("*/recommendations", () =>
    HttpResponse.json(recommendationsFixture),
  ),
  http.get("*/health/readiness", () =>
    HttpResponse.json({
      gates: readinessFixture,
    }),
  ),
  http.post("*/activepieces/session", () => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 120_000);
    const runtimeFlowId =
      installedAutomationFixture.runtimeFlowId ?? "flow_msw_automation";
    const instanceUrl = activepiecesEmbedTokenFixture.instanceUrl;

    return HttpResponse.json({
      status: "ready",
      readiness_code: "READY",
      session_id: `sess_msw_${Date.now().toString(36)}`,
      mode: "iframe_embed",
      issued_at: issuedAt.toISOString(),
      instance_url: instanceUrl,
      builder_url: `${instanceUrl}/flows/${runtimeFlowId}`,
      initial_route: `/flows/${runtimeFlowId}`,
      jwt_token: "msw-activepieces-session-jwt",
      expires_at: expiresAt.toISOString(),
      ttl_seconds: 120,
      locale: "ru",
      brand_display_name: "LexFrame",
      role: "EDITOR",
      permissions: {
        can_view: true,
        can_edit: true,
        can_manage_connections: false,
        can_open_diagnostics: true,
      },
      pieces_policy: {
        pieces_filter_type: "ALLOWED",
        pieces_tags: activepiecesEmbedTokenFixture.piecesTags,
        policy_hash: "sha256:msw-policy",
      },
      sdk_config: {
        container_id: "activepieces-canvas-msw",
        prefix: "/automation-runtime",
        locale: "ru",
        brand_display_name: "LexFrame",
        design_system: "activepieces_like",
        navigation_sync: true,
      },
      design_system: "activepieces_like",
      flow_binding: {
        automation_id: installedAutomationFixture.id,
        activepieces_project_id:
          installedAutomationFixture.runtimeProjectId ?? "proj_msw_automation",
        activepieces_flow_id: runtimeFlowId,
        activepieces_flow_version_id: null,
        sync_status: "synced",
        sync_hash: installedAutomationFixture.syncHash ?? null,
      },
      runtime_status: {
        ap_app: "ok",
        ap_worker: "ok",
        ap_db: "ok",
        redis: "ok",
      },
      ai_test_policy: {
        status: "ok",
        block_required_ai_tests: false,
        allow_non_ai_canvas_editing: true,
      },
      diagnostics: {
        trace_id: "trace_msw_activepieces_session",
        safe_to_show: true,
        ap_app: "ok",
        ap_worker: "ok",
        local_owner_keys: "ready",
      },
    });
  }),
  http.post("*/activepieces/session/:sessionId/initialized", ({ params }) =>
    HttpResponse.json({
      status: "initialized",
      session_id: String(params.sessionId),
      initialized_at: new Date().toISOString(),
    }),
  ),
  http.post("*/activepieces/embed-token", () =>
    HttpResponse.json(activepiecesEmbedTokenFixture),
  ),
  http.get("*/rbac/roles", () => HttpResponse.json(roleDefinitionsFixture)),
  http.get("*/rbac/permissions", () =>
    HttpResponse.json(permissionDefinitionsFixture),
  ),
  http.get("*/account/security", () =>
    HttpResponse.json(securityAccountFixture),
  ),
  http.get("*/audit/events", () => HttpResponse.json(state.auditEvents)),

  http.get("*/workspaces/:workspaceId/members", () =>
    HttpResponse.json(state.members),
  ),

  http.patch(
    "*/workspaces/:workspaceId/members/:memberId/role",
    async ({ params, request }) => {
      const memberId = String(params.memberId);
      const payload =
        (await request.json()) as UpdateWorkspaceMemberRoleRequest;
      const nextMembers = state.members.map((member) =>
        member.id === memberId ? { ...member, role: payload.role } : member,
      );
      const nextMember =
        nextMembers.find((member) => member.id === memberId) ?? null;

      if (!nextMember) {
        return HttpResponse.json(
          {
            error: {
              code: "MEMBER_NOT_FOUND",
              message: "Workspace member not found.",
            },
            path: `/workspaces/${params.workspaceId}/members/${memberId}/role`,
            requestId: "req_msw",
          },
          { status: 404 },
        );
      }

      state.members = nextMembers;
      appendAudit(
        "workspace.member.role_changed",
        "workspace_member",
        memberId,
        {
          role: payload.role,
        },
      );

      return HttpResponse.json(nextMember);
    },
  ),

  http.delete("*/workspaces/:workspaceId/members/:memberId", ({ params }) => {
    const memberId = String(params.memberId);
    state.members = state.members.map((member) =>
      member.id === memberId ? { ...member, status: "removed" } : member,
    );
    appendAudit("workspace.member.removed", "workspace_member", memberId);

    return HttpResponse.json({
      status: "removed",
    });
  }),

  http.get("*/workspaces/:workspaceId/invitations", () =>
    HttpResponse.json(state.invitations),
  ),

  http.post("*/workspaces/:workspaceId/invitations", async ({ request }) => {
    const payload = (await request.json()) as CreateWorkspaceInvitationRequest;
    const invitation: WorkspaceInvitation = {
      id: `inv_${Date.now()}`,
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      revokedAt: null,
      deliveryMode: "mock",
      deliveryPreview: {
        acceptToken: `mock-${Date.now()}`,
        acceptUrl: `http://127.0.0.1:3000/invite/mock-${Date.now()}`,
      },
    };
    state.invitations = [invitation, ...state.invitations];
    appendAudit(
      "workspace.invitation.created",
      "workspace_invitation",
      invitation.id,
      {
        email: invitation.email,
        role: invitation.role,
      },
    );

    return HttpResponse.json(invitation, { status: 201 });
  }),

  http.delete(
    "*/workspaces/:workspaceId/invitations/:invitationId",
    ({ params }) => {
      const invitationId = String(params.invitationId);
      state.invitations = state.invitations.map((invitation) =>
        invitation.id === invitationId
          ? {
              ...invitation,
              status: "revoked",
              revokedAt: new Date().toISOString(),
            }
          : invitation,
      );
      appendAudit(
        "workspace.invitation.revoked",
        "workspace_invitation",
        invitationId,
      );

      return HttpResponse.json({
        status: "revoked",
      });
    },
  ),

  http.get("*/documents", ({ request }) => {
    const url = new URL(request.url);
    const query: DocumentListQuery = {
      q: url.searchParams.get("q") ?? undefined,
      kind: (url.searchParams.get("kind") as DocumentKind | null) ?? undefined,
      status:
        (url.searchParams.get("status") as DocumentStatus | null) ?? undefined,
      classification:
        (url.searchParams.get("classification") as
          | DocumentSummary["classification"]
          | null) ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    };

    return HttpResponse.json({
      items: filterDocuments(query),
      nextCursor: null,
    });
  }),

  http.get("*/documents/:documentId", ({ params }) => {
    const detail = getDocumentOrResponse(String(params.documentId));

    return detail instanceof HttpResponse ? detail : HttpResponse.json(detail);
  }),

  http.get("*/documents/:documentId/versions", ({ params }) => {
    const detail = getDocumentOrResponse(String(params.documentId));

    return detail instanceof HttpResponse
      ? detail
      : HttpResponse.json(sortVersions(detail.versions));
  }),

  http.post("*/documents/upload-intents", async ({ request }) => {
    const payload = (await request.json()) as DocumentUploadIntentRequest;
    const documentId = `doc_${Date.now()}`;
    const versionId = `docv_${Date.now()}`;
    const version = buildVersion(
      documentId,
      versionId,
      1,
      payload.originalFilename,
      payload.mimeType,
      payload.sizeBytes,
    );

    const detail: DocumentDetail = {
      id: documentId,
      workspaceId: activeWorkspaceId(),
      ownerId: state.sessionContext.actor?.id ?? "usr_demo",
      title: payload.title,
      description: payload.description ?? null,
      kind: payload.kind,
      status: "upload_pending",
      classification: payload.classification,
      source: deriveSource(payload.kind),
      tags: payload.tags ?? [],
      currentVersion: version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
      deletedAt: null,
      versions: [version],
      storageObjects: [],
      relations: (payload.relations ?? []).map((relation, index) => ({
        id: `rel_${documentId}_${index}`,
        relationType: relation.relationType,
        targetEntityType: relation.targetEntityType,
        targetEntityId: relation.targetEntityId,
        createdAt: new Date().toISOString(),
      })),
      processingJobs: [],
      availableActions: {
        canUploadVersion: true,
        canDelete: true,
        canRestore: false,
        canManageTemplate: payload.kind === "document_template",
        canRequestSignedUrl: true,
      },
    };

    state.documents.set(documentId, detail);
    appendAudit("document.upload.intent_created", "document", documentId, {
      versionId,
      classification: payload.classification,
    });

    return HttpResponse.json(
      {
        documentId,
        versionId,
        bucket:
          payload.kind === "generated_document"
            ? "artifacts-private"
            : "documents-private",
        storagePath: buildStoragePath(
          documentId,
          versionId,
          "original",
          payload.originalFilename,
        ),
        uploadMethod: "direct",
        maxSizeBytes: 25 * 1024 * 1024,
        allowedMimeTypes: [...ALLOWED_MIME_TYPES],
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
      { status: 201 },
    );
  }),

  http.post(
    "*/documents/:documentId/versions/upload-intent",
    async ({ params, request }) => {
      const documentId = String(params.documentId);
      const detail = getDocumentOrResponse(documentId);

      if (detail instanceof HttpResponse) {
        return detail;
      }

      const payload =
        (await request.json()) as CreateDocumentVersionUploadIntentRequest;
      const nextVersionNo =
        detail.versions.reduce(
          (max, version) => Math.max(max, version.versionNo),
          0,
        ) + 1;
      const versionId = `docv_${Date.now()}`;
      const version = buildVersion(
        documentId,
        versionId,
        nextVersionNo,
        payload.originalFilename,
        payload.mimeType,
        payload.sizeBytes,
      );

      state.documents.set(documentId, {
        ...detail,
        updatedAt: new Date().toISOString(),
        versions: sortVersions([...detail.versions, version]),
      });
      appendAudit(
        "document.version.intent_created",
        "document_version",
        versionId,
        {
          documentId,
          versionNo: nextVersionNo,
        },
      );

      return HttpResponse.json(
        {
          documentId,
          versionId,
          bucket:
            detail.kind === "generated_document"
              ? "artifacts-private"
              : "documents-private",
          storagePath: buildStoragePath(
            documentId,
            versionId,
            "original",
            payload.originalFilename,
          ),
          uploadMethod: "direct",
          maxSizeBytes: 25 * 1024 * 1024,
          allowedMimeTypes: [...ALLOWED_MIME_TYPES],
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
        { status: 201 },
      );
    },
  ),

  http.post(
    "*/documents/:documentId/versions/:versionId/complete",
    async ({ params, request }) => {
      const documentId = String(params.documentId);
      const versionId = String(params.versionId);
      const detail = getDocumentOrResponse(documentId);

      if (detail instanceof HttpResponse) {
        return detail;
      }

      const payload = (await request.json()) as CompleteUploadRequest;
      const nextDetail = finalizeVersion(detail, versionId, payload);

      state.documents.set(documentId, nextDetail);
      appendAudit("document.version.completed", "document_version", versionId, {
        documentId,
      });

      return HttpResponse.json(nextDetail);
    },
  ),

  http.post(
    "*/documents/:documentId/versions/:versionId/make-current",
    ({ params }) => {
      const documentId = String(params.documentId);
      const versionId = String(params.versionId);
      const detail = getDocumentOrResponse(documentId);

      if (detail instanceof HttpResponse) {
        return detail;
      }

      const version =
        detail.versions.find((item) => item.id === versionId) ?? null;
      if (!version) {
        return HttpResponse.json(
          {
            error: {
              code: "DOCUMENT_VERSION_NOT_FOUND",
              message: "Document version not found.",
            },
            path: `/documents/${documentId}/versions/${versionId}/make-current`,
            requestId: "req_msw",
          },
          { status: 404 },
        );
      }

      const nextDetail: DocumentDetail = {
        ...detail,
        currentVersion: version,
        updatedAt: new Date().toISOString(),
      };

      state.documents.set(documentId, nextDetail);
      appendAudit(
        "document.version.made_current",
        "document_version",
        versionId,
        {
          documentId,
        },
      );

      return HttpResponse.json(nextDetail);
    },
  ),

  http.post(
    "*/documents/:documentId/signed-url",
    async ({ params, request }) => {
      const documentId = String(params.documentId);
      const detail = getDocumentOrResponse(documentId);

      if (detail instanceof HttpResponse) {
        return detail;
      }

      const payload = (await request.json()) as {
        readonly versionId?: string;
        readonly objectRole: DocumentObjectRole;
        readonly purpose: "download" | "preview";
      };
      const versionId = payload.versionId ?? detail.currentVersion?.id;

      if (!versionId) {
        return HttpResponse.json(
          {
            error: {
              code: "DOCUMENT_VERSION_NOT_FOUND",
              message: "Document version not found.",
            },
            path: `/documents/${documentId}/signed-url`,
            requestId: "req_msw",
          },
          { status: 404 },
        );
      }

      if (detail.status === "soft_deleted" || detail.deletedAt) {
        return HttpResponse.json(
          {
            error: {
              code: "DOCUMENT_STATE_INVALID",
              message: "Signed URLs are blocked for deleted documents.",
            },
            path: `/documents/${documentId}/signed-url`,
            requestId: "req_msw",
          },
          { status: 409 },
        );
      }

      const version =
        detail.versions.find((item) => item.id === versionId) ?? null;
      if (version?.scanStatus === "infected") {
        return HttpResponse.json(
          {
            error: {
              code: "VIRUS_DETECTED",
              message:
                "Signed URLs are blocked for infected document versions.",
            },
            path: `/documents/${documentId}/signed-url`,
            requestId: "req_msw",
          },
          { status: 409 },
        );
      }

      const expiresInSeconds = payload.purpose === "preview" ? 300 : 120;
      appendAudit("document.signed_url.issued", "document", documentId, {
        versionId,
        objectRole: payload.objectRole,
      });

      return HttpResponse.json(
        buildSignedUrl(
          documentId,
          versionId,
          payload.objectRole,
          expiresInSeconds,
        ),
      );
    },
  ),

  http.post("*/documents/:documentId/archive", ({ params }) => {
    const documentId = String(params.documentId);
    const detail = getDocumentOrResponse(documentId);

    if (detail instanceof HttpResponse) {
      return detail;
    }

    state.documents.set(documentId, {
      ...detail,
      status: "archived",
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      availableActions: {
        ...detail.availableActions,
        canRestore: true,
      },
    });
    appendAudit("document.archived", "document", documentId);

    return HttpResponse.json({
      status: "archived",
      documentId,
    });
  }),

  http.post("*/documents/:documentId/restore", ({ params }) => {
    const documentId = String(params.documentId);
    const detail = getDocumentOrResponse(documentId);

    if (detail instanceof HttpResponse) {
      return detail;
    }

    state.documents.set(documentId, {
      ...detail,
      status: detail.currentVersion ? "ready" : "upload_pending",
      archivedAt: null,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
      availableActions: {
        ...detail.availableActions,
        canRestore: false,
      },
    });
    appendAudit("document.restored", "document", documentId);

    return HttpResponse.json({
      status: "restored",
      documentId,
    });
  }),

  http.delete("*/documents/:documentId", ({ params }) => {
    const documentId = String(params.documentId);
    const detail = getDocumentOrResponse(documentId);

    if (detail instanceof HttpResponse) {
      return detail;
    }

    state.documents.set(documentId, {
      ...detail,
      status: "soft_deleted",
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      availableActions: {
        ...detail.availableActions,
        canRestore: true,
      },
    });
    appendAudit("document.soft_deleted", "document", documentId);

    return HttpResponse.json({
      status: "deleted",
      documentId,
    });
  }),

  http.get("*/runs/:runId/artifacts", ({ params }) =>
    HttpResponse.json(
      state.runArtifacts.filter(
        (artifact) => artifact.workflowRunId === String(params.runId),
      ),
    ),
  ),

  http.post("*/runs/:runId/artifacts", async ({ params, request }) => {
    const runId = String(params.runId);
    const payload = (await request.json()) as CreateRunArtifactRequest;
    const documentId = `doc_artifact_${Date.now()}`;
    const versionId = `docv_artifact_${Date.now()}`;
    const version = buildVersion(
      documentId,
      versionId,
      1,
      `${payload.title}.pdf`,
      payload.mimeType,
      221184,
    );
    const finalDetail = finalizeVersion(
      {
        id: documentId,
        workspaceId: activeWorkspaceId(),
        ownerId: state.sessionContext.actor?.id ?? "usr_demo",
        title: payload.title,
        description: null,
        kind: (payload.artifactType as DocumentKind) || "generated_document",
        status: "processing",
        classification: payload.classification,
        source: payload.source,
        tags: [runId, "run-artifact"],
        currentVersion: version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
        deletedAt: null,
        versions: [version],
        storageObjects: [],
        relations: [
          {
            id: `rel_${documentId}_run`,
            relationType: "output_of_workflow_run",
            targetEntityType: "workflow_run",
            targetEntityId: runId,
            createdAt: new Date().toISOString(),
          },
        ],
        processingJobs: [],
        availableActions: {
          canUploadVersion: true,
          canDelete: true,
          canRestore: false,
          canManageTemplate: false,
          canRequestSignedUrl: true,
        },
      },
      versionId,
      {
        clientReportedSize: 221184,
        clientReportedMimeType: payload.mimeType,
      },
    );

    state.documents.set(documentId, finalDetail);

    const artifact: RunArtifact = {
      id: `rart_${Date.now()}`,
      workflowRunId: runId,
      documentId,
      documentVersionId: versionId,
      artifactType: payload.artifactType,
      title: payload.title,
      mimeType: payload.mimeType,
      source: payload.source,
      createdAt: new Date().toISOString(),
    };

    state.runArtifacts = [artifact, ...state.runArtifacts];
    appendAudit("run.artifact.created", "run_artifact", artifact.id, {
      runId,
      documentId,
    });

    return HttpResponse.json(artifact, { status: 201 });
  }),
];
