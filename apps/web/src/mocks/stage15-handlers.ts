import type {
  Stage15CreateProjectRequest,
  Stage15CreateProjectChatRequest,
  Stage15ProjectSummary,
  Stage15ProjectChatSummary,
} from "@lexframe/contracts";
import {
  installedAutomationFixture,
  stage15CreatedProjectChatFixture,
  stage15ProjectChatsFixture,
  stage15ProjectDetailFixture,
  stage15ProjectListFixture,
  stage15ProjectSnapshotFixture,
  stage15ProjectsFixture,
  stage15WorkflowDraftMaterializeFixture,
} from "@lexframe/contracts";
import { HttpResponse, http } from "msw";

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

const state: {
  stage15Projects: Stage15ProjectSummary[];
  stage15ProjectChats: Stage15ProjectChatSummary[];
} = {
  stage15Projects: [...clone(stage15ProjectsFixture)],
  stage15ProjectChats: [...clone(stage15ProjectChatsFixture)],
};

export function buildStage15ProjectSnapshot(projectId: string) {
  const project =
    state.stage15Projects.find((item) => item.id === projectId) ??
    state.stage15Projects[0]!;

  return {
    ...clone(stage15ProjectSnapshotFixture),
    project,
    recentChats: state.stage15ProjectChats.filter(
      (chat) => chat.projectId === project.id,
    ),
  };
}

export const stage15Handlers = [
  http.get("*/projects", () =>
    HttpResponse.json({ ...clone(stage15ProjectListFixture), items: state.stage15Projects }),
  ),
  http.post("*/projects", async ({ request }) => {
    const payload = (await request
      .json()
      .catch(() => ({}))) as Stage15CreateProjectRequest;
    const name = payload.name?.trim() || "New project";
    const project: Stage15ProjectSummary = {
      ...clone(stage15ProjectsFixture[0]!),
      id: `project_${Date.now()}`,
      name,
      description: payload.description?.trim() ?? "",
      icon: name.charAt(0).toUpperCase() || "P",
      color: payload.color?.trim() || "#3B82F6",
      counters: {
        chats: 0,
        automations: 0,
        documents: 0,
        activeRuns: 0,
        pendingApprovals: 0,
        recommendations: 0,
        missingConnections: 0,
      },
      lastActivityAt: new Date().toISOString(),
    };
    state.stage15Projects = [project, ...state.stage15Projects];

    return HttpResponse.json({ project });
  }),
  http.get("*/projects/:projectId", ({ params }) => {
    const projectId = String(params.projectId);
    const summary =
      state.stage15Projects.find((item) => item.id === projectId) ??
      state.stage15Projects[0]!;

    return HttpResponse.json({
      ...clone(stage15ProjectDetailFixture),
      ...summary,
      chats: state.stage15ProjectChats.filter(
        (chat) => chat.projectId === summary.id,
      ),
    });
  }),
  http.get("*/projects/:projectId/chats", ({ params }) =>
    HttpResponse.json(
      state.stage15ProjectChats.filter(
        (chat) => chat.projectId === String(params.projectId),
      ),
    ),
  ),
  http.post("*/projects/:projectId/chats", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const payload = (await request
      .json()
      .catch(() => ({}))) as Stage15CreateProjectChatRequest;
    const chat: Stage15ProjectChatSummary = {
      ...clone(stage15CreatedProjectChatFixture.chat),
      id: `chat_${Date.now()}`,
      projectId,
      title: payload.title?.trim() || "New project chat",
      selectedDocumentIds: payload.selectedDocumentIds ?? [],
      linkedAutomationId: payload.currentAutomationId ?? null,
      updatedAt: new Date().toISOString(),
    };
    state.stage15ProjectChats = [chat, ...state.stage15ProjectChats];

    return HttpResponse.json({
      chat,
      session: {
        ...clone(stage15CreatedProjectChatFixture.session),
        id: `aisess_${Date.now()}`,
        source: payload.source ?? "project_chat",
        title: chat.title,
        currentAutomationId: payload.currentAutomationId ?? null,
        selectedDocumentIds: payload.selectedDocumentIds ?? [],
        selectedTemplateIds: payload.selectedTemplateIds ?? [],
        updatedAt: chat.updatedAt,
      },
    });
  }),
  http.get("*/projects/:projectId/automations", () =>
    HttpResponse.json([installedAutomationFixture]),
  ),
  http.post("*/workflow-drafts/:draftId/materialize", () =>
    HttpResponse.json(stage15WorkflowDraftMaterializeFixture),
  ),
];
