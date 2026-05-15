import type {
  ChatAttachmentUploadIntentRequest,
  ChatMessageAttachmentDto,
  ChatMessageDto,
  ChatRunSummary,
  ChatStreamEvent,
  ChatStreamSnapshot,
  ChatThreadResponse,
  ChatThreadSummary,
  CreateChatMessageRequest,
  ProjectKnowledgeItem,
  ProjectWebSearchRequest,
  ProjectWebSearchResult,
  Stage15CreateProjectRequest,
  Stage15CreateProjectChatRequest,
  Stage15ProjectSummary,
  Stage15ProjectChatSummary,
  Stage15UpdateProjectRequest,
  UpdateChatThreadRequest,
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
import { HttpResponse, delay, http } from "msw";
import { applyBlock5MswControls } from "./e2e-control";

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function buildProjectKnowledgeItem({
  id,
  projectId,
  sourceId,
  summary = null,
  title,
  url,
}: {
  readonly id: string;
  readonly projectId: string;
  readonly sourceId: string;
  readonly summary?: string | null;
  readonly title: string;
  readonly url: string;
}): ProjectKnowledgeItem {
  const timestamp = new Date().toISOString();

  return {
    id,
    workspaceId: "workspace_demo",
    projectId,
    sourceType: "web_search_result",
    sourceId,
    title,
    summary,
    url,
    mode: "reference_only",
    classification: "public",
    pinned: false,
    enabledForChat: true,
    citationRequired: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildChatThreadSummary(
  chat: Stage15ProjectChatSummary,
): ChatThreadSummary {
  return {
    id: chat.id,
    workspaceId: "workspace_demo",
    projectId: chat.projectId,
    kind: "project",
    visibility: "project",
    status: chat.status === "active" ? "active" : "archived",
    title: chat.title,
    lastMessagePreview: chat.lastMessagePreview,
    currentBranchId: null,
    createdBy: "user_demo",
    createdAt: chat.updatedAt,
    updatedAt: chat.updatedAt,
    archivedAt: null,
    deletedAt: null,
  };
}

function buildChatMessage(input: {
  readonly id: string;
  readonly threadId: string;
  readonly projectId: string | null;
  readonly role: ChatMessageDto["role"];
  readonly text: string;
  readonly status?: ChatMessageDto["status"];
  readonly clientMessageId?: string | null;
  readonly branchId?: string | null;
  readonly branchInfo?: ChatMessageDto["branchInfo"];
  readonly attachments?: readonly ChatMessageAttachmentDto[];
  readonly createdAt?: string;
}): ChatMessageDto {
  const timestamp = input.createdAt ?? new Date().toISOString();

  return {
    id: input.id,
    threadId: input.threadId,
    workspaceId: "workspace_demo",
    projectId: input.projectId,
    role: input.role,
    status: input.status ?? "completed",
    parentMessageId: null,
    clientMessageId: input.clientMessageId ?? null,
    branchId: input.branchId ?? null,
    branchInfo: input.branchInfo ?? null,
    run: null,
    createdBy: input.role === "user" ? "user_demo" : null,
    requestId: "req_msw_block3",
    traceId: "trace_msw_block3",
    parts: [
      {
        id: `${input.id}_part`,
        type: input.role === "assistant" ? "markdown" : "text",
        text: input.text,
        payload: {},
        sequence: 0,
      },
    ],
    attachments: input.attachments ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildRunSummary(input: {
  readonly runId: string;
  readonly streamId: string;
  readonly threadId: string;
  readonly messageId?: string | null;
  readonly status: ChatRunSummary["status"];
  readonly errorCode?: string | null;
}): ChatRunSummary {
  const timestamp = new Date().toISOString();

  return {
    runId: input.runId,
    streamId: input.streamId,
    threadId: input.threadId,
    messageId: input.messageId ?? null,
    status: input.status,
    retryable: input.status === "failed",
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorCode ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt:
      input.status === "completed" ||
      input.status === "failed" ||
      input.status === "cancelled"
        ? timestamp
        : null,
  };
}

const state: {
  stage15Projects: Stage15ProjectSummary[];
  stage15ProjectChats: Stage15ProjectChatSummary[];
  stage15ProjectKnowledge: Record<string, ProjectKnowledgeItem[]>;
  chatThreads: Record<string, ChatThreadSummary>;
  chatMessages: Record<string, ChatMessageDto[]>;
  chatLatestRuns: Record<string, ChatRunSummary | null>;
  chatFailedOnceKeys: Set<string>;
  chatAttachments: Record<string, ChatMessageAttachmentDto>;
} = {
  stage15Projects: [...clone(stage15ProjectsFixture)],
  stage15ProjectChats: [...clone(stage15ProjectChatsFixture)],
  stage15ProjectKnowledge: {
    project_claim_001: [
      buildProjectKnowledgeItem({
        id: "knowledge_block2_tab_source",
        projectId: "project_claim_001",
        sourceId: "knowledge_block2_tab_source",
        title: "Block2 Source Fixture",
        url: "https://example.test/block2/source-fixture",
      }),
    ],
  },
  chatThreads: Object.fromEntries(
    clone(stage15ProjectChatsFixture).map((chat) => [
      chat.id,
      buildChatThreadSummary(chat),
    ]),
  ),
  chatMessages: {},
  chatLatestRuns: {},
  chatFailedOnceKeys: new Set(),
  chatAttachments: {},
};

let stage15Sequence = 0;
let persistedChatStateLoaded = false;

const CHAT_STATE_STORAGE_KEY = "lexframe.msw.stage15.chat-state";

interface PersistedChatState {
  readonly chatThreads?: Record<string, ChatThreadSummary>;
  readonly chatMessages?: Record<string, ChatMessageDto[]>;
  readonly chatLatestRuns?: Record<string, ChatRunSummary | null>;
  readonly chatAttachments?: Record<string, ChatMessageAttachmentDto>;
  readonly chatFailedOnceKeys?: string[];
}

function loadPersistedChatState() {
  if (persistedChatStateLoaded || typeof window === "undefined") {
    return;
  }

  persistedChatStateLoaded = true;
  const raw = window.sessionStorage.getItem(CHAT_STATE_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const persisted = JSON.parse(raw) as PersistedChatState;
    state.chatThreads = {
      ...state.chatThreads,
      ...(persisted.chatThreads ?? {}),
    };
    state.chatMessages = {
      ...state.chatMessages,
      ...(persisted.chatMessages ?? {}),
    };
    state.chatLatestRuns = {
      ...state.chatLatestRuns,
      ...(persisted.chatLatestRuns ?? {}),
    };
    state.chatAttachments = {
      ...state.chatAttachments,
      ...(persisted.chatAttachments ?? {}),
    };
    state.chatFailedOnceKeys = new Set(persisted.chatFailedOnceKeys ?? []);
  } catch {
    window.sessionStorage.removeItem(CHAT_STATE_STORAGE_KEY);
  }
}

function persistChatState() {
  if (typeof window === "undefined") {
    return;
  }

  const persisted: PersistedChatState = {
    chatThreads: state.chatThreads,
    chatMessages: state.chatMessages,
    chatLatestRuns: state.chatLatestRuns,
    chatAttachments: state.chatAttachments,
    chatFailedOnceKeys: Array.from(state.chatFailedOnceKeys),
  };
  window.sessionStorage.setItem(
    CHAT_STATE_STORAGE_KEY,
    JSON.stringify(persisted),
  );
}

function nextStage15Id(prefix: string) {
  stage15Sequence += 1;
  return `${prefix}_${Date.now()}_${stage15Sequence}`;
}

function ensureChatThread(threadId: string, projectId: string | null = "project_claim_001") {
  loadPersistedChatState();
  if (!state.chatThreads[threadId]) {
    const timestamp = new Date().toISOString();
    state.chatThreads[threadId] = {
      id: threadId,
      workspaceId: "workspace_demo",
      projectId,
      kind: projectId ? "project" : "general",
      visibility: projectId ? "project" : "private",
      status: "active",
      title: "MSW chat thread",
      lastMessagePreview: null,
      currentBranchId: null,
      createdBy: "user_demo",
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      deletedAt: null,
    };
    persistChatState();
  }

  state.chatMessages[threadId] ??= [];
  return state.chatThreads[threadId]!;
}

function ensureBlock3BranchFixture(threadId: string) {
  if (threadId !== "thread_block3_branch") {
    return;
  }

  const thread = ensureChatThread(threadId, "project_claim_001");
  state.chatThreads[threadId] = {
    ...thread,
    title: "Block3 branch fixture",
    currentBranchId: "branch_block3_a",
  };

  if ((state.chatMessages[threadId] ?? []).length > 0) {
    return;
  }

  state.chatMessages[threadId] = [
    buildChatMessage({
      id: "message_block3_branch_user",
      threadId,
      projectId: "project_claim_001",
      role: "user",
      text: "Block3 branch source prompt",
      createdAt: "2026-05-13T08:00:00.000Z",
    }),
    buildChatMessage({
      id: "message_block3_branch_assistant",
      threadId,
      projectId: "project_claim_001",
      role: "assistant",
      text: "Block3 branch answer",
      branchId: "branch_block3_a",
      branchInfo: {
        branchId: "branch_block3_a",
        activeBranchId: "branch_block3_a",
        ordinal: 1,
        total: 2,
        canSwitch: true,
      },
      createdAt: "2026-05-13T08:00:01.000Z",
    }),
  ];
  persistChatState();
}

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

function addChatMessage(message: ChatMessageDto) {
  loadPersistedChatState();
  const current = state.chatMessages[message.threadId] ?? [];
  const byId = new Map(current.map((item) => [item.id, item]));
  byId.set(message.id, message);
  state.chatMessages[message.threadId] = Array.from(byId.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  persistChatState();
}

function buildStreamSnapshot(input: {
  readonly streamId: string;
  readonly threadId: string;
  readonly userMessage: ChatMessageDto;
  readonly assistantMessage: ChatMessageDto | null;
  readonly events: readonly ChatStreamEvent[];
  readonly status?: ChatStreamSnapshot["status"];
}): ChatStreamSnapshot {
  return {
    streamId: input.streamId,
    workspaceId: "workspace_demo",
    threadId: input.threadId,
    messageId: input.assistantMessage?.id ?? `message_${input.streamId}`,
    status: input.status ?? "completed",
    clientMessageId: input.userMessage.clientMessageId ?? null,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
    run: state.chatLatestRuns[input.threadId] ?? null,
    events: input.events,
  };
}

function sseFrame(event: ChatStreamEvent | { readonly type: "done"; readonly payload: Record<string, unknown> }) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function buildSseResponse(events: readonly (ChatStreamEvent | { readonly type: "done"; readonly payload: Record<string, unknown> })[]) {
  return new HttpResponse(events.map((event) => sseFrame(event)).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

async function handleChatStreamRequest(
  threadId: string,
  payload: CreateChatMessageRequest,
  wantsEvents: boolean,
) {
  const thread = ensureChatThread(threadId);
  const text = payload.text?.trim() ?? "";
  const streamId = nextStage15Id("stream_block3");
  const assistantId = nextStage15Id("message_assistant_block3");
  const userMessage = buildChatMessage({
    id: nextStage15Id("message_user_block3"),
    threadId,
    projectId: thread.projectId,
    role: "user",
    text,
    clientMessageId: payload.clientMessageId ?? null,
    attachments: (payload.attachmentIds ?? []).flatMap((attachmentId) =>
      state.chatAttachments[attachmentId] ? [state.chatAttachments[attachmentId]!] : [],
    ),
  });
  addChatMessage(userMessage);

  state.chatLatestRuns[threadId] = buildRunSummary({
    runId: nextStage15Id("run_block3"),
    streamId,
    threadId,
    status: /BLOCK3_RELOAD_PENDING/i.test(text) ? "recovering" : "thinking",
  });
  persistChatState();

  if (/BLOCK3_FAIL_ONCE/i.test(text) && !state.chatFailedOnceKeys.has(text)) {
    state.chatFailedOnceKeys.add(text);
    state.chatLatestRuns[threadId] = buildRunSummary({
      runId: nextStage15Id("run_block3"),
      streamId,
      threadId,
      status: "failed",
      errorCode: "AI_GATEWAY_NOT_READY",
    });
    persistChatState();

    return HttpResponse.json(
      {
        error: {
          code: "AI_GATEWAY_NOT_READY",
          message: "Provider unavailable.",
        },
      },
      {
        status: 503,
        headers: {
          "x-error-code": "AI_GATEWAY_NOT_READY",
          "x-request-id": "req_msw_block3_failure",
        },
      },
    );
  }

  const delayMs = /BLOCK3_RELOAD_PENDING/i.test(text)
    ? 8_000
    : /BLOCK3_CANCEL|BLOCK3_DELAY/i.test(text)
      ? 2_000
      : /BLOCK3_ENTER|BLOCK3_DOUBLE/i.test(text)
        ? 500
        : 50;

  await delay(delayMs);

  if (state.chatLatestRuns[threadId]?.status === "cancelled") {
    const snapshot = buildStreamSnapshot({
      streamId,
      threadId,
      userMessage,
      assistantMessage: null,
      events: [],
      status: "cancelled",
    });

    return wantsEvents
      ? buildSseResponse([{ type: "done", payload: { snapshot } }])
      : HttpResponse.json(snapshot);
  }

  const assistantText = `Block3 assistant response for ${text || "empty prompt"}`;
  const assistantMessage = buildChatMessage({
    id: assistantId,
    threadId,
    projectId: thread.projectId,
    role: "assistant",
    text: assistantText,
  });
  addChatMessage(assistantMessage);
  state.chatLatestRuns[threadId] = buildRunSummary({
    runId: nextStage15Id("run_block3"),
    streamId,
    threadId,
    messageId: assistantMessage.id,
    status: "completed",
  });
  persistChatState();

  const events: ChatStreamEvent[] = [
    {
      type: "run_status",
      payload: {
        streamId,
        threadId,
        messageId: assistantMessage.id,
        status: "streaming",
      },
    },
    {
      type: "message_start",
      payload: {
        streamId,
        threadId,
        messageId: assistantMessage.id,
        clientMessageId: payload.clientMessageId ?? null,
      },
    },
    {
      type: "text_delta",
      payload: {
        messageId: assistantMessage.id,
        delta: assistantText,
      },
    },
    {
      type: "message_done",
      payload: {
        messageId: assistantMessage.id,
        status: "completed",
      },
    },
  ];
  const snapshot = buildStreamSnapshot({
    streamId,
    threadId,
    userMessage,
    assistantMessage,
    events,
  });

  return wantsEvents
    ? buildSseResponse([...events, { type: "done", payload: { snapshot } }])
    : HttpResponse.json(snapshot);
}

export const stage15Handlers = [
  http.get("*/projects", async () => {
    const controlled = await applyBlock5MswControls("GET /projects");
    if (controlled) {
      return controlled;
    }

    return HttpResponse.json({
      ...clone(stage15ProjectListFixture),
      items: state.stage15Projects,
    });
  }),
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
  http.patch("*/projects/:projectId", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `PATCH /projects/${projectId}`,
    );
    if (controlled) {
      return controlled;
    }

    const current = state.stage15Projects.find((item) => item.id === projectId);

    if (!current) {
      return HttpResponse.json(
        {
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found.",
          },
        },
        { status: 404 },
      );
    }

    const payload = (await request
      .json()
      .catch(() => ({}))) as Stage15UpdateProjectRequest;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const description =
      typeof payload.description === "string"
        ? payload.description.trim()
        : current.description;
    const color =
      typeof payload.color === "string" && payload.color.trim()
        ? payload.color.trim()
        : current.color;
    const updated: Stage15ProjectSummary = {
      ...current,
      ...(name
        ? {
            name,
            icon: name.charAt(0).toUpperCase() || current.icon,
          }
        : {}),
      description,
      color,
      lastActivityAt: new Date().toISOString(),
    };

    state.stage15Projects = state.stage15Projects.map((project) =>
      project.id === projectId ? updated : project,
    );

    return HttpResponse.json({ project: updated });
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
  http.get("*/projects/:projectId/snapshot", async ({ params }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `GET /projects/${projectId}/snapshot`,
    );
    if (controlled) {
      return controlled;
    }

    return HttpResponse.json(buildStage15ProjectSnapshot(projectId));
  }),
  http.get("*/projects/:projectId/chats", ({ params }) =>
    HttpResponse.json(
      state.stage15ProjectChats.filter(
        (chat) => chat.projectId === String(params.projectId),
      ),
    ),
  ),
  http.get("*/projects/:projectId/knowledge", async ({ params }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `GET /projects/${projectId}/knowledge`,
    );
    if (controlled) {
      return controlled;
    }

    await delay(1_000);

    return HttpResponse.json({
      items: state.stage15ProjectKnowledge[projectId] ?? [],
    });
  }),
  http.post("*/projects/:projectId/web-search", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `POST /projects/${projectId}/web-search`,
    );
    if (controlled) {
      return controlled;
    }

    const payload = (await request
      .json()
      .catch(() => ({}))) as ProjectWebSearchRequest;
    const query = payload.query?.trim() ?? "";

    if (/provider outage|unavailable|503/i.test(query)) {
      return HttpResponse.json(
        {
          error: {
            code: "provider_failed",
            message: "Provider unavailable.",
          },
        },
        { status: 503 },
      );
    }

    const resultTitle = /saved web source/i.test(query)
      ? "Block2 Web Search Source"
      : `Web source: ${query || "project search"}`;
    const resultUrl = /saved web source/i.test(query)
      ? "https://example.test/block2/web-search-source"
      : `https://example.test/project-search/${encodeURIComponent(
          query || "project-search",
        )}`;
    const result: ProjectWebSearchResult = {
      id: `web_${Date.now()}`,
      title: resultTitle,
      url: resultUrl,
      snippet: `Search result for ${query || "project search"}`,
      sourceType: "web_search_result",
      knowledgeItemId: `knowledge_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (payload.saveResults !== false) {
      const current = state.stage15ProjectKnowledge[projectId] ?? [];
      if (!current.some((item) => item.url === result.url)) {
        state.stage15ProjectKnowledge[projectId] = [
          ...current,
          buildProjectKnowledgeItem({
            id: result.knowledgeItemId ?? `knowledge_${Date.now()}`,
            projectId,
            sourceId: result.id,
            title: result.title,
            url: result.url,
            summary: result.snippet,
          }),
        ];
      }
    }

    return HttpResponse.json({
      provider: "tavily",
      status: "ok",
      items: [result],
      error: null,
    });
  }),
  http.post("*/projects/:projectId/chats", async ({ params, request }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `POST /projects/${projectId}/chats`,
    );
    if (controlled) {
      return controlled;
    }

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
    state.chatThreads[chat.id] = buildChatThreadSummary(chat);
    state.chatMessages[chat.id] ??= [];
    persistChatState();

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
  http.get("*/chat/threads/:threadId", ({ params }) => {
    const threadId = String(params.threadId);
    ensureBlock3BranchFixture(threadId);
    const thread = state.chatThreads[threadId] ?? null;

    if (!thread) {
      return HttpResponse.json(
        {
          error: {
            code: "CHAT_THREAD_NOT_FOUND",
            message: "Chat thread not found.",
          },
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({ thread } satisfies ChatThreadResponse);
  }),
  http.patch("*/chat/threads/:threadId", async ({ params, request }) => {
    const threadId = String(params.threadId);
    const controlled = await applyBlock5MswControls(
      `PATCH /chat/threads/${threadId}`,
    );
    if (controlled) {
      return controlled;
    }

    const payload = (await request
      .json()
      .catch(() => ({}))) as UpdateChatThreadRequest;
    const thread = ensureChatThread(threadId);
    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : thread.title;
    const updatedAt = new Date().toISOString();
    const nextThread: ChatThreadSummary = {
      ...thread,
      title,
      updatedAt,
    };

    state.chatThreads[threadId] = nextThread;
    state.stage15ProjectChats = state.stage15ProjectChats.map((chat) =>
      chat.id === threadId ? { ...chat, title, updatedAt } : chat,
    );
    persistChatState();

    return HttpResponse.json({ thread: nextThread } satisfies ChatThreadResponse);
  }),
  http.post("*/chat/threads", async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as {
      readonly title?: string | null;
      readonly kind?: "general";
    };
    const timestamp = new Date().toISOString();
    const thread: ChatThreadSummary = {
      id: nextStage15Id("thread_global_block3"),
      workspaceId: "workspace_demo",
      projectId: null,
      kind: payload.kind ?? "general",
      visibility: "private",
      status: "active",
      title: payload.title?.trim() || "Новый чат",
      lastMessagePreview: null,
      currentBranchId: null,
      createdBy: "user_demo",
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      deletedAt: null,
    };
    state.chatThreads[thread.id] = thread;
    state.chatMessages[thread.id] = [];
    persistChatState();

    return HttpResponse.json({ thread } satisfies ChatThreadResponse);
  }),
  http.get("*/chat/threads/:threadId/messages", ({ params }) => {
    const threadId = String(params.threadId);
    ensureBlock3BranchFixture(threadId);
    ensureChatThread(threadId);

    return HttpResponse.json({
      items: state.chatMessages[threadId] ?? [],
      latestRun: state.chatLatestRuns[threadId] ?? null,
    });
  }),
  http.post("*/chat/threads/:threadId/messages:stream", async ({
    params,
    request,
  }) => {
    const payload = (await request
      .json()
      .catch(() => ({ text: "" }))) as CreateChatMessageRequest;
    const wantsEvents =
      request.headers.get("accept")?.includes("text/event-stream") ?? false;

    return handleChatStreamRequest(String(params.threadId), payload, wantsEvents);
  }),
  http.post("*/chat/threads/:threadId/streams/:streamId/cancel", ({
    params,
  }) => {
    const threadId = String(params.threadId);
    const streamId = String(params.streamId);
    state.chatLatestRuns[threadId] = buildRunSummary({
      runId: nextStage15Id("run_block3"),
      streamId,
      threadId,
      status: "cancelled",
    });
    persistChatState();

    return HttpResponse.json({
      streamId,
      threadId,
      status: "cancelled",
    });
  }),
  http.post("*/chat/threads/:threadId/branch", ({ params }) => {
    const sourceThreadId = String(params.threadId);
    const source = ensureChatThread(sourceThreadId);
    const timestamp = new Date().toISOString();
    const thread: ChatThreadSummary = {
      ...source,
      id: nextStage15Id("thread_branch_block3"),
      currentBranchId: nextStage15Id("branch_block3"),
      updatedAt: timestamp,
    };
    state.chatThreads[thread.id] = thread;
    state.chatMessages[thread.id] = clone(state.chatMessages[sourceThreadId] ?? []);
    persistChatState();

    return HttpResponse.json({ thread } satisfies ChatThreadResponse);
  }),
  http.post("*/chat/threads/:threadId/branches/:branchId/switch", ({
    params,
  }) => {
    const thread = ensureChatThread(String(params.threadId));
    const nextThread = {
      ...thread,
      currentBranchId: String(params.branchId),
      updatedAt: new Date().toISOString(),
    };
    state.chatThreads[nextThread.id] = nextThread;
    persistChatState();

    return HttpResponse.json({ thread: nextThread } satisfies ChatThreadResponse);
  }),
  http.post("*/chat/attachments/upload-intents", async ({ request }) => {
    const controlled = await applyBlock5MswControls(
      "POST /chat/attachments/upload-intents",
    );
    if (controlled) {
      return controlled;
    }

    const payload = (await request
      .json()
      .catch(() => ({ files: [] }))) as ChatAttachmentUploadIntentRequest;
    const timestamp = new Date().toISOString();

    return HttpResponse.json({
      items: payload.files.map((file) => {
        const id = nextStage15Id("attachment_block3");
        const attachment: ChatMessageAttachmentDto = {
          id,
          sourceType: "uploaded_file",
          sourceId: id,
          mode: "thread_attachment",
          classification: "workspace_internal",
          citationRequired: false,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          status: "pending_upload",
          downloadPath: `/chat/attachments/${id}/download`,
          storageKey: null,
          metadata: {},
        };
        state.chatAttachments[id] = attachment;
        persistChatState();

        return {
          id,
          clientAttachmentId: file.clientAttachmentId ?? null,
          uploadUrl: `https://uploads.example.test/${id}`,
          method: "PUT" as const,
          headers: { "content-type": file.mimeType },
          expiresAt: timestamp,
          attachment,
        };
      }),
      errors: [],
    });
  }),
  http.post("*/chat/attachments/:attachmentId/complete", ({ params }) => {
    const attachmentId = String(params.attachmentId);
    const attachment = state.chatAttachments[attachmentId] ?? null;

    if (!attachment) {
      return HttpResponse.json(
        {
          error: {
            code: "CHAT_ATTACHMENT_NOT_FOUND",
            message: "Chat attachment not found.",
          },
        },
        { status: 404 },
      );
    }

    state.chatAttachments[attachmentId] = {
      ...attachment,
      status: "uploaded",
    };
    persistChatState();

    return HttpResponse.json({ attachment: state.chatAttachments[attachmentId] });
  }),
  http.get("*/projects/:projectId/automations", async ({ params }) => {
    const projectId = String(params.projectId);
    const controlled = await applyBlock5MswControls(
      `GET /projects/${projectId}/automations`,
    );
    if (controlled) {
      return controlled;
    }

    return HttpResponse.json([installedAutomationFixture]);
  }),
  http.post("*/workflow-drafts/:draftId/materialize", () =>
    HttpResponse.json(stage15WorkflowDraftMaterializeFixture),
  ),
];
