import type {
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage15ProjectSummary,
  Stage15WorkflowDraftMaterializeResponse,
} from "../stage15";
import { aiChatSessionsFixture, aiDraftFixture } from "./ai-fixtures";
import {
  documentsFixture,
  installedAutomationFixture,
  recommendationsFixture,
  runArtifactsFixture,
  runsFixture,
  sessionContextFixture,
} from "./demo-data";

const workspaceId =
  sessionContextFixture.activeWorkspace?.id ?? "ws_01hzyd70jqgr8k9gr6m4y80p81";

export const stage15ProjectChatsFixture: readonly Stage15ProjectChatSummary[] = [
  {
    id: "chat_project_claim_001",
    projectId: "project_claim_001",
    title: "Претензия к поставщику",
    status: "active",
    lastMessagePreview:
      "Собери сценарий: анализ материалов, практика, претензия и согласование отправки.",
    selectedDocumentIds: ["doc_01hzstage2claim"],
    linkedAutomationId: installedAutomationFixture.id,
    updatedAt: "2026-04-23T08:45:00.000Z",
  },
  {
    id: "chat_project_claim_002",
    projectId: "project_claim_001",
    title: "Проверка рисков отправки",
    status: "active",
    lastMessagePreview:
      "Проверь, какие внешние действия требуют ручного подтверждения.",
    selectedDocumentIds: [],
    linkedAutomationId: null,
    updatedAt: "2026-04-23T07:20:00.000Z",
  },
];

export const stage15ProjectsFixture: readonly Stage15ProjectSummary[] = [
  {
    id: "project_claim_001",
    workspaceId,
    name: "Досудебная претензия А40-101/2026",
    description:
      "Материалы дела, чат, автоматизация подготовки претензии и контроль внешней отправки.",
    icon: "scale",
    color: "#C7A46A",
    status: "active",
    ownerUserId: sessionContextFixture.actor?.id ?? null,
    role: "owner",
    counters: {
      chats: stage15ProjectChatsFixture.length,
      automations: 1,
      documents: documentsFixture.items.length,
      activeRuns: runsFixture.filter((run) =>
        ["running", "waiting_approval", "delivering"].includes(run.status),
      ).length,
      pendingApprovals: 1,
      recommendations: recommendationsFixture.length,
      missingConnections: 1,
    },
    lastActivityAt: "2026-04-23T08:45:00.000Z",
  },
  {
    id: "project_research_002",
    workspaceId,
    name: "Мониторинг практики по поставке",
    description:
      "Исследовательский проект с источниками, рекомендациями и черновиками будущих сценариев.",
    icon: "book-open",
    color: "#74B7A5",
    status: "active",
    ownerUserId: sessionContextFixture.actor?.id ?? null,
    role: "editor",
    counters: {
      chats: 0,
      automations: 0,
      documents: 0,
      activeRuns: 0,
      pendingApprovals: 0,
      recommendations: 2,
      missingConnections: 0,
    },
    lastActivityAt: "2026-04-22T17:10:00.000Z",
  },
];

export const stage15SystemStatusFixture = {
  overall: "degraded" as const,
  summary:
    "Workspace готов к Stage 15 preview; realtime и external delivery показаны как контролируемо деградировавшие контуры.",
  checkedAt: "2026-04-23T09:00:00.000Z",
  incidentsOpen: 0,
  components: [
    {
      code: "backend",
      label: "Backend API",
      status: "healthy" as const,
      summary: "Session context, runtime and run snapshots are available.",
      checkedAt: "2026-04-23T09:00:00.000Z",
    },
    {
      code: "activepieces",
      label: "Activepieces",
      status: "healthy" as const,
      summary: "Embed-token boundary is available through backend.",
      checkedAt: "2026-04-23T09:00:00.000Z",
    },
    {
      code: "realtime",
      label: "Realtime",
      status: "degraded" as const,
      summary: "Snapshot is authoritative; live updates may fall back to polling.",
      checkedAt: "2026-04-23T09:00:00.000Z",
    },
  ],
};

export const stage15ProjectListFixture: Stage15ProjectListResponse = {
  items: stage15ProjectsFixture,
};

const primaryStage15Project = stage15ProjectsFixture[0]!;
const primaryStage15ProjectChat = stage15ProjectChatsFixture[0]!;

export const stage15ProjectDetailFixture: Stage15ProjectDetail = {
  ...primaryStage15Project,
  chats: stage15ProjectChatsFixture,
  automations: [installedAutomationFixture],
  documents: documentsFixture.items,
  recentRuns: runsFixture,
  pendingApprovals: [],
  recommendations: recommendationsFixture,
  systemStatus: stage15SystemStatusFixture,
};

export const stage15ProjectSnapshotFixture: Stage15ProjectSnapshot = {
  snapshotVersion: 1501,
  generatedAt: "2026-04-23T09:00:00.000Z",
  project: primaryStage15Project,
  recentChats: stage15ProjectChatsFixture,
  projectAutomations: [installedAutomationFixture],
  projectDocuments: documentsFixture.items,
  activeRuns: runsFixture,
  failedRuns: runsFixture.filter((run) => run.status === "failed"),
  pendingApprovals: [],
  recentArtifacts: runArtifactsFixture,
  recommendations: recommendationsFixture,
  unreadNotificationsCount: 1,
  systemStatus: stage15SystemStatusFixture,
};

export const stage15CreatedProjectChatFixture: Stage15ProjectChatCreatedResponse = {
  chat: primaryStage15ProjectChat,
  session: {
    ...aiChatSessionsFixture[0]!,
    source: "project_chat",
  },
};

export const stage15WorkflowDraftMaterializeFixture: Stage15WorkflowDraftMaterializeResponse = {
  draft: {
    ...aiDraftFixture,
    linkedAutomationId: installedAutomationFixture.id,
  },
  automation: installedAutomationFixture,
  automationUrl: `/app/projects/project_claim_001/automations/${installedAutomationFixture.id}`,
  builderUrl: `/app/projects/project_claim_001/automations/${installedAutomationFixture.id}/builder`,
};
