import type {
  InstalledAutomationDetail,
  Stage15CreateProjectChatRequest,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
} from "@lexframe/contracts";
import {
  buildQueryString,
  requestJson,
  withJsonBody,
  type FetchOptions,
} from "./core";

export interface Stage15Api {
  listProjects(): Promise<Stage15ProjectListResponse>;
  getProject(projectId: string): Promise<Stage15ProjectDetail>;
  getProjectDashboardSnapshot(
    projectId: string,
  ): Promise<Stage15ProjectSnapshot>;
  listProjectChats(
    projectId: string,
  ): Promise<readonly Stage15ProjectChatSummary[]>;
  createProjectChat(
    projectId: string,
    input?: Stage15CreateProjectChatRequest,
  ): Promise<Stage15ProjectChatCreatedResponse>;
  listProjectAutomations(
    projectId: string,
  ): Promise<readonly InstalledAutomationDetail[]>;
}

export function createStage15Client(options: FetchOptions): Stage15Api {
  return {
    listProjects: () => requestJson(options, "/projects"),
    getProject: (projectId) => requestJson(options, `/projects/${projectId}`),
    getProjectDashboardSnapshot: (projectId) =>
      requestJson(
        options,
        `/dashboard/snapshot${buildQueryString({ projectId })}`,
      ),
    listProjectChats: (projectId) =>
      requestJson(options, `/projects/${projectId}/chats`),
    createProjectChat: (projectId, input = {}) =>
      requestJson(
        options,
        `/projects/${projectId}/chats`,
        withJsonBody(input, { method: "POST" }),
      ),
    listProjectAutomations: (projectId) =>
      requestJson(options, `/projects/${projectId}/automations`),
  };
}
