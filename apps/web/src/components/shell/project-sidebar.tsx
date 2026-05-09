"use client";

import type { ChatSearchResult, Stage15ProjectSummary } from "@lexframe/contracts";
import {
  Cable,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Library,
  LogOut,
  MessageSquare,
  MessageSquarePlus,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Sun,
  Wrench,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCreateStage15Project,
  useCreateStage15ProjectChat,
  useStage15Projects,
} from "@/hooks/domain/stage15";
import { useNotifications } from "@/hooks/use-stage0-data";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { useStage15ShellStore } from "@/stores/stage15-shell-store";
import { SettingsButton } from "@/features/settings";
import { countSidebarNotifications } from "./sidebar-notifications";

const fallbackProjectId = "project_claim_001";
const defaultProjectColor = "#3B82F6";

export function ProjectSidebar({
  forceCollapsed = false,
}: {
  readonly forceCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { apiClient, sessionContext, signOut } = useSessionBridge();
  const { theme, toggleTheme } = useTheme();
  const [railPreviewOpen, setRailPreviewOpen] = React.useState(false);
  const [projectFormOpen, setProjectFormOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<readonly ChatSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [recentChats, setRecentChats] = React.useState<readonly ChatSearchResult[]>([]);
  const [recentChatsLoading, setRecentChatsLoading] = React.useState(false);
  const [recentChatsError, setRecentChatsError] = React.useState<string | null>(null);

  const projectsQuery = useStage15Projects();
  const projects = projectsQuery.data?.items ?? [];
  const activeProjectIdFromPath = readProjectIdFromPath(pathname);
  const storedActiveProjectId = useStage15ShellStore((state) => state.activeProjectId);
  const activeProjectId =
    activeProjectIdFromPath ??
    storedActiveProjectId ??
    projects[0]?.id ??
    fallbackProjectId;
  const setActiveProjectId = useStage15ShellStore((state) => state.setActiveProjectId);
  const storedCollapsed = useStage15ShellStore((state) => state.sidebarCollapsed);
  const setCollapsed = useStage15ShellStore((state) => state.setSidebarCollapsed);
  const collapsed = forceCollapsed || storedCollapsed;

  const permissions = new Set(sessionContext.permissions);
  const canViewDashboard = permissions.has("dashboard.view");
  const canSearchChats = permissions.has("chat.search");
  const notifications = useNotifications(
    { limit: 50, status: "unread" },
    { enabled: canViewDashboard },
  );
  const notificationCounts = React.useMemo(
    () => countSidebarNotifications(notifications.data?.items ?? []),
    [notifications.data?.items],
  );
  const createChat = useCreateStage15ProjectChat(activeProjectId);
  const createProject = useCreateStage15Project();
  const themeToggleLabel =
    theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
  const automationsHref = `/app/projects/${activeProjectId}/automations`;

  React.useEffect(() => {
    if (activeProjectId) {
      setActiveProjectId(activeProjectId);
    }
  }, [activeProjectId, setActiveProjectId]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRailPreviewOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  React.useEffect(() => {
    let cancelled = false;

    if (!canSearchChats) {
      setRecentChats([]);
      setRecentChatsError(null);
      return;
    }

    setRecentChatsLoading(true);
    setRecentChatsError(null);

    void apiClient
      .searchChats({ q: "" })
      .then((response) => {
        if (!cancelled) {
          setRecentChats(response.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentChatsError("Чаты временно недоступны.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRecentChatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, canSearchChats, sessionContext.activeWorkspace?.id]);

  const handleCreateChat = async () => {
    if (!activeProjectId) {
      return;
    }

    const response = await createChat.mutateAsync({
      source: "project_chat",
      title: null,
    });
    router.push(`/app/projects/${activeProjectId}/chats/${response.chat.id}`);
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();

    if (!name) {
      return;
    }

    const response = await createProject.mutateAsync({
      name,
      description: "",
      color: defaultProjectColor,
    });
    setProjectName("");
    setProjectFormOpen(false);
    router.push(`/app/projects/${response.project.id}`);
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setSearchError(null);

    try {
      const response = await apiClient.searchChats({
        q: searchQuery.trim(),
        projectId: activeProjectId,
      });
      setSearchResults(response.items);
    } catch {
      setSearchError("Поиск временно недоступен.");
    } finally {
      setSearching(false);
    }
  };

  const openChatResult = (result: ChatSearchResult) => {
    const projectId = result.thread.projectId ?? activeProjectId;
    router.push(`/app/projects/${projectId}/chats/${result.thread.id}`);
  };

  const sidebarBody = (
    <>
      <BrandBlock
        collapsed={false}
        onCollapse={() => setCollapsed(true)}
        theme={theme}
        themeToggleLabel={themeToggleLabel}
        onToggleTheme={toggleTheme}
      />

      <section className="grid gap-2">
        <Button
          type="button"
          onClick={() => void handleCreateChat()}
          disabled={createChat.isPending || !activeProjectId}
          className="h-10 w-full justify-start"
          aria-label="Новый чат"
        >
          <MessageSquarePlus size={17} />
          <span>Новый чат</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full justify-start"
          aria-label="Поиск в чатах"
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search size={17} />
          <span>Поиск в чатах</span>
        </Button>
        {searchOpen ? (
          <SearchPanel
            query={searchQuery}
            results={searchResults}
            searching={searching}
            error={searchError}
            activeProjectId={activeProjectId}
            onQueryChange={setSearchQuery}
            onSubmit={handleSearch}
            onOpenResult={(result) => {
              openChatResult(result);
              setSearchOpen(false);
            }}
          />
        ) : null}
      </section>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
        <SidebarSection title="Чаты">
          <RecentChatsList
            activeProjectId={activeProjectId}
            chats={recentChats}
            error={recentChatsError}
            loading={recentChatsLoading}
            onOpenChat={openChatResult}
          />
        </SidebarSection>

        <CollapsibleSidebarSection
          title="Инструменты"
          open={toolsOpen}
          onToggle={() => setToolsOpen((open) => !open)}
        >
          <SidebarLink
            href="/app/connectors"
            icon={<Cable size={17} />}
            label="Коннекторы"
            active={pathname.startsWith("/app/connectors")}
          />
          <SidebarLink
            href="/app/pulse"
            icon={<Sparkles size={17} />}
            label="Пульс"
            active={pathname.startsWith("/app/pulse")}
          />
          <SidebarLink
            href="/sources"
            icon={<Library size={17} />}
            label="Библиотека актов"
            active={pathname.startsWith("/sources")}
          />
        </CollapsibleSidebarSection>

        <SidebarSection title="Проекты">
          <div className="flex items-center gap-1">
            <Link
              href="/app/projects"
              className={cn(
                "flex min-h-10 flex-1 items-center gap-2 rounded-[var(--lf-radius-control)] px-3 py-2 text-sm",
                pathname === "/app/projects"
                  ? "bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
                  : "text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
              )}
            >
              <FolderOpen size={16} />
              <span className="min-w-0 flex-1 truncate">Все проекты</span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              aria-label="Создать проект"
              onClick={() => setProjectFormOpen((open) => !open)}
            >
              <Plus size={15} />
            </Button>
          </div>
          {projectFormOpen ? (
            <form
              className="grid gap-2 rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] p-3"
              onSubmit={(event) => void handleCreateProject(event)}
            >
              <label className="grid gap-1 text-xs font-medium text-[color:var(--lf-text-muted)]">
                Название проекта
                <input
                  className="h-9 rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-3 text-sm text-[color:var(--lf-text-primary)] outline-none focus:border-[color:var(--lf-primary)]"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Например, новый спор"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={!projectName.trim() || createProject.isPending}
              >
                Создать проект
              </Button>
            </form>
          ) : null}
          <div className="grid gap-1">
            {projects.length === 0 && projectsQuery.isLoading ? (
              <CompactMuted text="Загружаю проекты..." />
            ) : null}
            {projects.map((project) => (
              <ProjectLink
                key={project.id}
                project={project}
                active={activeProjectId === project.id}
              />
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="Автоматизации">
          <SidebarLink
            href={automationsHref}
            icon={<Workflow size={17} />}
            label="Автоматизации"
            active={pathname.startsWith(automationsHref)}
            badge={notificationCounts.automation}
          />
        </SidebarSection>
      </nav>

      <footer className="grid gap-3 border-t border-[color:var(--lf-border)] pt-4">
        <SettingsButton />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void signOut();
          }}
          className="w-full justify-start"
          aria-label="Выйти"
        >
          <LogOut size={16} />
          <span>Выйти</span>
        </Button>
      </footer>
    </>
  );

  if (collapsed) {
    return (
      <>
        <aside className="sidebar-sheen relative w-[88px] shrink-0 overflow-hidden px-4 py-5">
          <div className="noise-overlay absolute inset-0" />
          <div className="relative grid h-full min-h-screen grid-rows-[auto_1fr_auto] justify-items-center gap-4">
            <div className="grid justify-items-center gap-3">
              <RailLink href="/app/projects" label="LexFrame">
                <span className="font-[family-name:var(--font-display)] text-lg">L</span>
              </RailLink>
              <RailButton
                label={forceCollapsed ? "Открыть меню" : "Развернуть меню"}
                onClick={() => {
                  if (forceCollapsed) {
                    setRailPreviewOpen(true);
                    return;
                  }
                  setCollapsed(false);
                }}
              >
                <PanelLeftClose size={18} />
              </RailButton>
              <RailButton
                label="Новый чат"
                onClick={() => void handleCreateChat()}
                primary
                disabled={createChat.isPending || !activeProjectId}
              >
                <Plus size={20} />
              </RailButton>
              <RailButton label="Поиск в чатах" onClick={() => setRailPreviewOpen(true)}>
                <Search size={18} />
              </RailButton>
            </div>

            <nav className="grid content-start justify-items-center gap-3">
              <RailButton label="Чаты" onClick={() => setRailPreviewOpen(true)}>
                <MessageSquare size={18} />
              </RailButton>
              <RailButton label="Инструменты" onClick={() => setRailPreviewOpen(true)}>
                <Wrench size={18} />
              </RailButton>
              <RailLink href="/app/projects" label="Проекты">
                <FolderOpen size={18} />
              </RailLink>
              <RailLink href={automationsHref} label="Автоматизации">
                <Workflow size={18} />
              </RailLink>
            </nav>

            <div className="grid justify-items-center gap-3">
              <SettingsButton collapsed />
              <RailButton label={themeToggleLabel} onClick={toggleTheme}>
                <ThemeIcon theme={theme} />
              </RailButton>
              <RailButton
                label="Выйти"
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut size={18} />
              </RailButton>
            </div>
          </div>
        </aside>

        {forceCollapsed && railPreviewOpen ? (
          <div className="fixed bottom-5 left-[104px] top-5 z-50 flex w-[320px] flex-col gap-5 rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-4 shadow-[var(--lf-shadow-popover)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-display)] text-xl">LexFrame</div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--foreground)]"
                onClick={() => setRailPreviewOpen(false)}
                aria-label="Закрыть меню"
              >
                <X size={17} />
              </button>
            </div>
            {sidebarBody}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <aside className="sidebar-sheen relative w-[320px] shrink-0 overflow-hidden px-5 py-6 transition-[width] duration-200">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative flex h-full min-h-screen flex-col gap-5">
        {sidebarBody}
      </div>
    </aside>
  );
}

function BrandBlock({
  collapsed,
  onCollapse,
  onToggleTheme,
  theme,
  themeToggleLabel,
}: {
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onToggleTheme: () => void;
  readonly theme: "light" | "dark";
  readonly themeToggleLabel: string;
}) {
  if (collapsed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        href="/app/projects"
        className="flex min-w-0 items-center gap-3 rounded-[var(--lf-radius-control)] border border-transparent px-2 py-2 hover:border-[color:var(--lf-border)]"
        aria-label="LexFrame"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lf-radius-control)] border border-[color:var(--lf-ap-primary)]/40 bg-[color:var(--lf-state-active)] text-lg font-semibold text-[color:var(--lf-ap-primary-hover)]">
          L
        </div>
        <div className="min-w-0">
          <div className="truncate font-[family-name:var(--font-display)] text-xl">
            LexFrame
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
          onClick={onToggleTheme}
          className="h-9 w-9 px-0"
        >
          <ThemeIcon theme={theme} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Свернуть меню"
          onClick={onCollapse}
          className="h-9 w-9 px-0"
        >
          <PanelLeftClose size={16} />
        </Button>
      </div>
    </div>
  );
}

function SidebarSection({
  action,
  children,
  title,
}: {
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--lf-text-muted)]">
          {title}
        </h2>
        {action}
      </div>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function CollapsibleSidebarSection({
  children,
  onToggle,
  open,
  title,
}: {
  readonly children: React.ReactNode;
  readonly onToggle: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  return (
    <section className="grid gap-2">
      <button
        type="button"
        className="flex min-h-10 items-center gap-2 rounded-[var(--lf-radius-control)] px-3 py-2 text-left text-sm font-medium text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open ? <div className="grid gap-1 pl-2">{children}</div> : null}
    </section>
  );
}

function SidebarLink({
  active,
  badge,
  href,
  icon,
  label,
}: {
  readonly active: boolean;
  readonly badge?: number;
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly label: string;
}) {
  const hasBadge = Boolean(badge && badge > 0);

  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-h-10 items-center gap-2 rounded-[var(--lf-radius-control)] px-3 py-2 text-sm transition",
        active
          ? "bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
          : "text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hasBadge ? <Badge variant="accent">{badge}</Badge> : null}
    </Link>
  );
}

function RecentChatsList({
  activeProjectId,
  chats,
  error,
  loading,
  onOpenChat,
}: {
  readonly activeProjectId: string;
  readonly chats: readonly ChatSearchResult[];
  readonly error: string | null;
  readonly loading: boolean;
  readonly onOpenChat: (result: ChatSearchResult) => void;
}) {
  if (loading && chats.length === 0) {
    return <CompactMuted text="Загружаю чаты..." />;
  }

  if (error) {
    return <CompactMuted text={error} />;
  }

  if (chats.length === 0) {
    return <CompactMuted text="Пока нет чатов." />;
  }

  return (
    <div className="grid gap-1">
      {chats.map((result) => (
        <RecentChatLink
          key={result.thread.id}
          activeProjectId={activeProjectId}
          result={result}
          onOpenChat={onOpenChat}
        />
      ))}
    </div>
  );
}

function RecentChatLink({
  activeProjectId,
  onOpenChat,
  result,
}: {
  readonly activeProjectId: string;
  readonly onOpenChat: (result: ChatSearchResult) => void;
  readonly result: ChatSearchResult;
}) {
  const projectId = result.thread.projectId ?? activeProjectId;
  const preview = result.snippet ?? result.thread.lastMessagePreview;

  return (
    <Link
      href={`/app/projects/${projectId}/chats/${result.thread.id}`}
      aria-label={result.thread.title}
      className="grid gap-0.5 rounded-[var(--lf-radius-control)] px-3 py-2 text-sm text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
      onClick={(event) => {
        event.preventDefault();
        onOpenChat(result);
      }}
    >
      <span className="truncate font-medium">{result.thread.title}</span>
      {preview ? (
        <span className="truncate text-xs text-[color:var(--muted)]">{preview}</span>
      ) : null}
    </Link>
  );
}

function ProjectLink({
  active,
  project,
}: {
  readonly active: boolean;
  readonly project: Stage15ProjectSummary;
}) {
  return (
    <Link
      href={`/app/projects/${project.id}`}
      aria-label={project.name}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-[var(--lf-radius-control)] px-3 py-2 text-sm transition",
        active
          ? "bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
          : "text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
      )}
    >
      <FolderOpen size={15} />
      <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
    </Link>
  );
}

function SearchPanel({
  activeProjectId,
  error,
  onOpenResult,
  onQueryChange,
  onSubmit,
  query,
  results,
  searching,
}: {
  readonly activeProjectId: string;
  readonly error: string | null;
  readonly onOpenResult: (result: ChatSearchResult) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly query: string;
  readonly results: readonly ChatSearchResult[];
  readonly searching: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] p-3">
      <form onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="sidebar-chat-search">
          Поиск в чатах
        </label>
        <input
          id="sidebar-chat-search"
          className="h-9 w-full rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-3 text-sm outline-none focus:border-[color:var(--lf-primary)]"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Введите тему или фразу"
        />
      </form>
      {searching ? <CompactMuted text="Ищу чаты..." /> : null}
      {error ? <CompactMuted text={error} /> : null}
      {results.length > 0 ? (
        <div className="grid gap-1">
          {results.map((result) => (
            <button
              key={`${result.thread.id}-${result.messageId ?? "thread"}`}
              type="button"
              className="grid rounded-[var(--lf-radius-control)] px-2 py-2 text-left text-sm hover:bg-[color:var(--lf-state-hover)]"
              onClick={() => onOpenResult(result)}
            >
              <span className="truncate font-medium">{result.thread.title}</span>
              <span className="truncate text-xs text-[color:var(--muted)]">
                {result.snippet ?? result.thread.lastMessagePreview ?? activeProjectId}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RailLink({
  active,
  children,
  href,
  label,
}: {
  readonly active?: boolean;
  readonly children: React.ReactNode;
  readonly href: string;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-[18px] border transition",
        active
          ? "border-[color:var(--lf-primary)] bg-[color:var(--lf-state-active)] text-[color:var(--lf-primary)]"
          : "border-transparent text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </Link>
  );
}

function RailButton({
  children,
  disabled,
  label,
  onClick,
  primary,
}: {
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
  readonly primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-[18px] border transition disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "border-transparent bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] hover:bg-[color:var(--lf-primary-hover)]"
          : "border-transparent text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function CompactMuted({ text }: { readonly text: string }) {
  return (
    <div className="rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] px-3 py-2 text-xs text-[color:var(--lf-text-muted)]">
      {text}
    </div>
  );
}

function ThemeIcon({ theme }: { readonly theme: "light" | "dark" }) {
  return theme === "dark" ? <Sun size={16} /> : <Moon size={16} />;
}

function readProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}
