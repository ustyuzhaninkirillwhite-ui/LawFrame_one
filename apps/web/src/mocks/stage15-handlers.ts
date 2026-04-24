import type {
  Stage15CreateProjectChatRequest,
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
  stage15ProjectChats: Stage15ProjectChatSummary[];
} = {
  stage15ProjectChats: [...clone(stage15ProjectChatsFixture)],
};

export function buildStage15ProjectSnapshot(projectId: string) {
  const project =
    stage15ProjectsFixture.find((item) => item.id === projectId) ??
    stage15ProjectsFixture[0]!;

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
    HttpResponse.json(clone(stage15ProjectListFixture)),
  ),
  http.get("*/projects/:projectId", ({ params }) => {
    const projectId = String(params.projectId);
    const summary =
      stage15ProjectsFixture.find((item) => item.id === projectId) ??
      stage15ProjectsFixture[0]!;

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
