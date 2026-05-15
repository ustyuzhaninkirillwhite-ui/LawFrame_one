import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectHome } from "./project-home";

const push = vi.fn();
const createProjectChat = vi.fn();
const streamChatMessage = vi.fn();
const listProjectKnowledge = vi.fn();
const searchProjectWeb = vi.fn();
const createProjectKnowledge = vi.fn();
const updateProject = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createProjectKnowledge,
      listProjectKnowledge,
      searchProjectWeb,
      streamChatMessage,
      updateProject,
    },
    sessionContext: {
      activeWorkspace: { id: "ws_1", name: "LexFrame" },
      permissions: [
        "chat.create",
        "chat.manage_project_context",
        "chat.view",
        "automation.read",
      ],
    },
  }),
}));

vi.mock("@/hooks/domain/stage15", () => ({
  useCreateStage15ProjectChat: () => ({
    isPending: false,
    mutateAsync: createProjectChat,
  }),
  useStage15ProjectAutomations: () => ({
    data: [
      {
        id: "automation_review",
        title: "Проверка позиции по делу",
        canOpenBuilder: true,
        canRun: true,
        nextGate: "ready",
      },
    ],
    isLoading: false,
  }),
  useStage15ProjectChats: () => ({
    data: [
      {
        id: "chat_project_recent",
        projectId: "project_alpha",
        title: "Проект для инвестора",
        status: "active",
        lastMessagePreview: "Распиши подробнее",
        selectedDocumentIds: [],
        linkedAutomationId: null,
        updatedAt: "2026-05-11T10:00:00.000Z",
      },
    ],
    error: null,
    isLoading: false,
  }),
  useStage15ProjectSnapshot: () => ({
    data: {
      project: {
        id: "project_alpha",
        workspaceId: "ws_1",
        name: "Lex_Frame_06.05",
        description: "Проектный чат и источники.",
        icon: "L",
        color: "#3B82F6",
        status: "active",
        ownerUserId: "usr_1",
        role: "owner",
        counters: {
          chats: 1,
          automations: 1,
          documents: 0,
          activeRuns: 0,
          pendingApprovals: 0,
          recommendations: 0,
          missingConnections: 0,
        },
        lastActivityAt: "2026-05-11T10:00:00.000Z",
      },
      recentChats: [],
      projectAutomations: [],
      projectDocuments: [],
      activeRuns: [],
      failedRuns: [],
      pendingApprovals: [],
      recommendations: [],
      recentArtifacts: [],
      systemStatus: null,
      generatedAt: "2026-05-11T10:00:00.000Z",
      snapshotVersion: 1,
    },
    isLoading: false,
  }),
}));

describe("ProjectHome", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    createProjectChat.mockResolvedValue({
      chat: { id: "chat_created", projectId: "project_alpha", title: "Новый чат" },
      session: { id: "chat_created", status: "active" },
    });
    streamChatMessage.mockResolvedValue({ status: "completed", events: [] });
    listProjectKnowledge.mockResolvedValue({
      items: [
        {
          id: "knowledge_web_1",
          workspaceId: "ws_1",
          projectId: "project_alpha",
          sourceType: "web_search_result",
          sourceId: "web_1",
          mode: "reference_only",
          classification: "public",
          pinned: false,
          enabledForChat: true,
          citationRequired: true,
          title: "Арбитражная практика",
          summary: "Подборка судебных актов",
          url: "https://example.test/case",
          createdAt: "2026-05-11T10:00:00.000Z",
          updatedAt: "2026-05-11T10:00:00.000Z",
        },
      ],
    });
    searchProjectWeb.mockResolvedValue({
      provider: "tavily",
      status: "ok",
      items: [
        {
          id: "web_result_1",
          title: "Найденный источник",
          url: "https://example.test/source",
          snippet: "Короткое описание источника",
          sourceType: "web_search_result",
          knowledgeItemId: "knowledge_web_2",
          createdAt: "2026-05-11T10:01:00.000Z",
        },
      ],
    });
    updateProject.mockResolvedValue({
      project: {
        id: "project_alpha",
        name: "Renamed workspace",
      },
    });
  });

  it("renders the compact project workspace instead of the old dashboard", async () => {
    renderProjectHome();

    expect(screen.getByTestId("project-workspace-shell")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lex_Frame_06.05" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Новый чат в Lex_Frame_06.05")).toBeInTheDocument();
    expect(screen.queryByText("Глубокое")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Чаты" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Источники" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Автоматизации" })).toBeInTheDocument();
    expect(screen.queryByText("Последние материалы")).not.toBeInTheDocument();
    expect(screen.queryByText("Прикрепить автоматизацию")).not.toBeInTheDocument();

    expect(await screen.findByText("Проект для инвестора")).toBeInTheDocument();
  });

  it("renames the current project from the project header", async () => {
    renderProjectHome();

    fireEvent.click(screen.getByRole("button", { name: "Переименовать проект Lex_Frame_06.05" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Название проекта" }), {
      target: { value: "Renamed workspace" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Название проекта" }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith("project_alpha", {
        name: "Renamed workspace",
      });
    });
  });

  it("renders project automations as a bottom tab instead of a dashboard card", async () => {
    renderProjectHome();

    fireEvent.click(screen.getByRole("tab", { name: "Автоматизации" }));

    expect(
      await screen.findByRole("link", { name: "Проверка позиции по делу" }),
    ).toHaveAttribute(
      "href",
      "/app/projects/project_alpha/automations/automation_review/automation",
    );
    expect(screen.queryByText("Сценарий автоматизации Stage 17")).not.toBeInTheDocument();
  });

  it("opens the plus menu and attaches an automation chip with an editor link", async () => {
    renderProjectHome();

    fireEvent.click(screen.getByRole("button", { name: "Добавить контекст" }));

    const menu = screen.getByTestId("project-plus-menu");
    expect(within(menu).getByRole("button", { name: "Добавить фото" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Фото или файлы" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Поиск по сети" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("button", { name: "Автоматизации" }));

    fireEvent.click(await screen.findByRole("button", { name: "Прикрепить Проверка позиции по делу" }));

    const chip = screen.getByTestId("selected-automation-chip");
    expect(chip).toHaveTextContent("Проверка позиции по делу");
    expect(within(chip).getByRole("link", { name: "Редактировать" })).toHaveAttribute(
      "href",
      "/app/projects/project_alpha/automations/automation_review/automation",
    );
  });

  it("adds and removes composer file chips without changing the project workspace shell", async () => {
    const { container } = renderProjectHome();
    const fileInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    const file = new File(["claim"], "claim-facts.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("claim-facts.txt")).toBeInTheDocument();
    expect(screen.getByTestId("project-workspace-shell")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Убрать файл|РЈР±СЂР°С‚СЊ С„Р°Р№Р»/i,
      }),
    );

    expect(screen.queryByText("claim-facts.txt")).not.toBeInTheDocument();
  });

  it("shows validation on invalid composer attachment chips and does not send them", async () => {
    const { container } = renderProjectHome();
    const fileInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    const emptyFile = new File([""], "empty.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [emptyFile] } });

    expect(await screen.findByText("empty.txt")).toBeInTheDocument();
    expect(
      screen.getByText(/Пустой файл\.|РџСѓСЃС‚РѕР№ С„Р°Р№Р»\./i),
    ).toBeInTheDocument();
    const prompt = "Проверить без валидных файлов";
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: prompt },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: /Отправить сообщение|РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ/i,
      }),
    );

    await waitFor(() => {
      expect(streamChatMessage).toHaveBeenCalledWith("chat_created", {
        attachments: [],
        attachmentIds: [],
        text: prompt,
      });
    });
  });

  it("keeps the old project dashboard and global floating composer out of the project workspace", () => {
    renderProjectHome();

    expect(screen.queryByText("РџРѕСЃР»РµРґРЅРёРµ РјР°С‚РµСЂРёР°Р»С‹")).not.toBeInTheDocument();
    expect(screen.queryByText("Р“Р»СѓР±РѕРєРѕРµ")).not.toBeInTheDocument();
    expect(screen.queryByTestId("floating-ai-composer")).not.toBeInTheDocument();
  });

  it("creates a project chat, sends the first message with automation context and opens the chat", async () => {
    renderProjectHome();

    fireEvent.click(screen.getByRole("button", { name: "Добавить контекст" }));
    fireEvent.click(screen.getByRole("button", { name: "Автоматизации" }));
    fireEvent.click(await screen.findByRole("button", { name: "Прикрепить Проверка позиции по делу" }));
    fireEvent.change(screen.getByPlaceholderText("Новый чат в Lex_Frame_06.05"), {
      target: { value: "Сравни материалы проекта" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    await waitFor(() => {
      expect(createProjectChat).toHaveBeenCalledWith({
        currentAutomationId: "automation_review",
        selectedDocumentIds: [],
        source: "project_chat",
        title: "Сравни материалы проекта",
      });
    });
    expect(streamChatMessage).toHaveBeenCalledWith("chat_created", {
      attachments: [
        {
          mode: "reference_only",
          sourceId: "automation_review",
          sourceType: "automation_snapshot",
        },
      ],
      attachmentIds: [],
      text: "Сравни материалы проекта",
    });
    expect(push).toHaveBeenCalledWith("/app/projects/project_alpha/chats/chat_created");
  });

  it("keeps the project composer recoverable when chat creation fails", async () => {
    createProjectChat.mockRejectedValueOnce(new Error("raw provider stack should stay hidden"));
    renderProjectHome();

    const prompt = "Проверить риск без потери черновика";
    const composer = screen.getByRole("textbox");
    fireEvent.change(composer, { target: { value: prompt } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    expect(await screen.findByText(/Сообщение не отправлено|Message was not sent/i)).toBeInTheDocument();
    expect(composer).toHaveValue(prompt);
    expect(screen.queryByText(/raw provider stack/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Отправить сообщение" })).not.toBeDisabled();
    });
  });

  it("does not apply stale web-search results after switching projects", async () => {
    let resolveSearch: ((value: Awaited<ReturnType<typeof searchProjectWeb>>) => void) | null =
      null;
    searchProjectWeb.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    const view = renderProjectHome();

    fireEvent.click(screen.getByRole("button", { name: "Добавить контекст" }));
    fireEvent.click(screen.getByRole("button", { name: "Поиск по сети" }));
    fireEvent.change(screen.getByLabelText("Запрос для поиска по сети"), {
      target: { value: "stale alpha query" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(searchProjectWeb).toHaveBeenCalledWith("project_alpha", {
        query: "stale alpha query",
        saveResults: true,
      });
    });

    view.rerenderProject("project_beta");

    await act(async () => {
      resolveSearch?.({
        provider: "tavily",
        status: "ok",
        items: [
          {
            id: "web_stale_alpha",
            title: "Stale Alpha Source",
            url: "https://example.test/stale-alpha",
            snippet: "Should not render after project switch",
            sourceType: "web_search_result",
            knowledgeItemId: "knowledge_stale_alpha",
            createdAt: "2026-05-11T10:01:00.000Z",
          },
        ],
        error: null,
      });
    });

    expect(screen.queryByText("Stale Alpha Source")).not.toBeInTheDocument();
    expect(screen.queryByText("Поиск по сети")).not.toBeInTheDocument();
  });

  it("clears project-scoped composer state when the project changes", async () => {
    const view = renderProjectHome();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Черновик проекта A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить контекст" }));
    fireEvent.click(screen.getByRole("button", { name: "Автоматизации" }));
    fireEvent.click(await screen.findByRole("button", { name: "Прикрепить Проверка позиции по делу" }));
    expect(screen.getByTestId("selected-automation-chip")).toBeInTheDocument();

    view.rerenderProject("project_beta");

    expect(screen.queryByTestId("selected-automation-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-plus-menu")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("guards project rename against Enter plus submit duplicate PATCH", async () => {
    let resolveUpdate: ((value: Awaited<ReturnType<typeof updateProject>>) => void) | null =
      null;
    updateProject.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    renderProjectHome();

    fireEvent.click(screen.getByRole("button", { name: "Переименовать проект Lex_Frame_06.05" }));
    const input = screen.getByRole("textbox", { name: "Название проекта" });
    fireEvent.change(input, { target: { value: "Deduped rename" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);

    expect(updateProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate?.({
        project: {
          id: "project_alpha",
          name: "Deduped rename",
        },
      });
    });
  });

  it("runs web search through the backend and renders saved project sources", async () => {
    renderProjectHome();

    fireEvent.click(screen.getByRole("tab", { name: "Источники" }));
    expect(await screen.findByText("Арбитражная практика")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Добавить контекст" }));
    fireEvent.click(screen.getByRole("button", { name: "Поиск по сети" }));
    fireEvent.change(screen.getByLabelText("Запрос для поиска по сети"), {
      target: { value: "практика по договору поставки" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));

    await waitFor(() => {
      expect(searchProjectWeb).toHaveBeenCalledWith("project_alpha", {
        query: "практика по договору поставки",
        saveResults: true,
      });
    });
    expect(await screen.findByText("Найденный источник")).toBeInTheDocument();
  });
});

function renderProjectHome(projectId = "project_alpha") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ProjectHome projectId={projectId} />
    </QueryClientProvider>,
  );

  return {
    ...view,
    rerenderProject(nextProjectId: string) {
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <ProjectHome projectId={nextProjectId} />
        </QueryClientProvider>,
      );
    },
  };
}
