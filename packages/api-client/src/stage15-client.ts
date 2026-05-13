import type {
  InstalledAutomationDetail,
  Stage15CreateProjectRequest,
  Stage15CreateProjectChatRequest,
  Stage15ProjectCreatedResponse,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage15ProjectUpdatedResponse,
  Stage15UpdateProjectRequest,
  Stage17CanvasEnsureResponse,
  Stage17CanvasEnsureWireResponse,
} from "@lexframe/contracts";
import { requestJson, withJsonBody, type FetchOptions } from "./core";

export interface Stage15Api {
  listProjects(): Promise<Stage15ProjectListResponse>;
  createProject(
    input: Stage15CreateProjectRequest,
  ): Promise<Stage15ProjectCreatedResponse>;
  updateProject(
    projectId: string,
    input: Stage15UpdateProjectRequest,
  ): Promise<Stage15ProjectUpdatedResponse>;
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
  ensureStage17CanvasAutomation(
    projectId: string,
  ): Promise<Stage17CanvasEnsureResponse>;
}

export function createStage15Client(options: FetchOptions): Stage15Api {
  return {
    listProjects: () => requestJson(options, "/projects"),
    createProject: (input) =>
      requestJson(options, "/projects", withJsonBody(input, { method: "POST" })),
    updateProject: (projectId, input) =>
      requestJson(
        options,
        `/projects/${projectId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    getProject: (projectId) => requestJson(options, `/projects/${projectId}`),
    getProjectDashboardSnapshot: (projectId) =>
      requestJson(options, `/projects/${projectId}/snapshot`),
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
    ensureStage17CanvasAutomation: async (projectId) =>
      mapStage17CanvasEnsureResponse(
        await requestJson<Stage17CanvasEnsureWireResponse>(
          options,
          `/projects/${projectId}/automations/stage17-canvas/ensure`,
          { method: "POST" },
        ),
      ),
  };
}

function mapStage17CanvasEnsureResponse(
  response: Stage17CanvasEnsureWireResponse,
): Stage17CanvasEnsureResponse {
  return {
    status: response.status,
    readinessCode: response.readiness_code,
    automationId: response.automation_id,
    projectId: response.project_id,
    route: response.route,
    activepiecesProjectId: response.activepieces_project_id,
    activepiecesFlowId: response.activepieces_flow_id,
    activepiecesFlowVersionId: response.activepieces_flow_version_id,
  };
}
