import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSidebar } from "./project-sidebar";

const push = vi.fn();
const searchChats = vi.fn();
let projectChats: readonly {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: "active";
  readonly lastMessagePreview: string | null;
  readonly selectedDocumentIds: readonly string[];
  readonly linkedAutomationId: string | null;
  readonly updatedAt: string;
}[] = [];
let pathname = "/app/connectors";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      searchChats,
    },
    signOut: vi.fn(),
    sessionContext: {
      activeWorkspace: { id: "ws_1", name: "Orlov & Partners" },
      permissions: [
        "dashboard.view",
        "workspace.read",
        "workspace.update",
        "chat.create",
        "chat.search",
        "automation.read",
      ],
    },
  }),
}));

vi.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/features/settings", () => ({
  SettingsButton: () => <button type="button">Настройки</button>,
}));

vi.mock("@/hooks/use-stage0-data", () => ({
  useNotifications: () => ({ data: { items: [] } }),
}));

const createChat = vi.fn().mockResolvedValue({
  chat: { id: "chat_created", projectId: "project_claim_001" },
});

vi.mock("@/hooks/domain/stage15", () => ({
  useCreateStage15ProjectChat: () => ({
    isPending: false,
    mutateAsync: createChat,
  }),
  useCreateStage15Project: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useStage15ProjectChats: () => ({ data: projectChats, isLoading: false, error: null }),
  useStage15Projects: () => ({
    data: {
      items: [
        {
          id: "project_claim_001",
          name: "Orlov & Partners",
          description: "Материалы дела",
          icon: "O",
          color: "#3B82F6",
          status: "active",
          counters: {
            chats: 0,
            automations: 1,
            documents: 0,
            activeRuns: 0,
            pendingApprovals: 0,
            recommendations: 0,
            missingConnections: 0,
          },
        },
      ],
    },
    isLoading: false,
  }),
}));

describe("ProjectSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    push.mockReset();
    searchChats.mockReset();
    createChat.mockClear();
    pathname = "/app/connectors";
    projectChats = [
      {
        id: "chat_project_recent",
        projectId: "project_claim_001",
        title: "Проектный чат из DB",
        status: "active",
        lastMessagePreview: "Последний вопрос в чате",
        selectedDocumentIds: [],
        linkedAutomationId: null,
        updatedAt: "2026-05-08T10:00:00.000Z",
      },
    ];
    searchChats.mockResolvedValue({
      items: [
        {
          thread: {
            id: "chat_1",
            workspaceId: "ws_1",
            projectId: "project_claim_001",
            kind: "project",
            visibility: "workspace",
            status: "active",
            title: "Проверка позиции по делу",
            lastMessagePreview: "Последний вопрос по претензии",
            currentBranchId: null,
            createdBy: "user_1",
            createdAt: "2026-05-07T12:00:00.000Z",
            updatedAt: "2026-05-07T12:30:00.000Z",
            archivedAt: null,
            deletedAt: null,
          },
          messageId: null,
          snippet: null,
          classification: null,
        },
      ],
      nextCursor: null,
    });
  });

  it("renders compact navigation without workspace subtitle or active project cards", async () => {
    render(<ProjectSidebar />);

    const brand = screen.getByLabelText("LexFrame");

    expect(within(brand).getByText("LexFrame")).toBeInTheDocument();
    expect(within(brand).queryByText("Orlov & Partners")).not.toBeInTheDocument();
    expect(screen.queryByText("Главная")).not.toBeInTheDocument();
    expect(screen.queryByText("Активный проект")).not.toBeInTheDocument();
    expect(screen.queryByText("0 чатов / 1 автоматизаций")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Новый чат" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Поиск в чатах" })).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Проектный чат из DB" }),
    ).toBeInTheDocument();
    expect(searchChats).not.toHaveBeenCalled();
  });

  it("orders chat, tools, project, and automation blocks", async () => {
    render(<ProjectSidebar />);

    const chats = await screen.findByRole("heading", { name: "Чаты" });
    const tools = screen.getByRole("button", { name: "Инструменты" });
    const projects = screen.getByRole("heading", { name: "Проекты" });
    const automations = screen.getByRole("heading", { name: "Автоматизации" });

    expect(precedes(chats, tools)).toBe(true);
    expect(precedes(tools, projects)).toBe(true);
    expect(precedes(projects, automations)).toBe(true);
  });

  it("keeps tools collapsed until the Tools button is clicked and orders tool links", () => {
    render(<ProjectSidebar />);

    const toolsButton = screen.getByRole("button", { name: "Инструменты" });

    expect(toolsButton.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Коннекторы" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Пульс" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Библиотека актов" })).not.toBeInTheDocument();

    fireEvent.click(toolsButton);

    const connectors = screen.getByRole("link", { name: "Коннекторы" });
    const pulse = screen.getByRole("link", { name: "Пульс" });
    const library = screen.getByRole("link", { name: "Библиотека актов" });

    expect(precedes(connectors, pulse)).toBe(true);
    expect(precedes(pulse, library)).toBe(true);
  });

  it("opens a recent chat from the project-scoped chat list", async () => {
    render(<ProjectSidebar />);

    fireEvent.click(
      await screen.findByRole("link", { name: "Проектный чат из DB" }),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/chats/chat_project_recent",
      );
    });
  });
});

function precedes(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}
