"use client";

import type { Stage15ProjectSummary } from "@lexframe/contracts";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCreateStage15ProjectChat,
  useStage15ProjectChats,
  useStage15Projects,
} from "@/hooks/domain/stage15";
import { useNotifications } from "@/hooks/use-stage0-data";
import { formatStatus } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";
import { useStage15ShellStore } from "@/stores/stage15-shell-store";
import { countSidebarNotifications } from "./sidebar-notifications";

const fallbackProjectId = "project_claim_001";

export function ProjectSidebar({
  forceCollapsed = false,
}: {
  readonly forceCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionContext, signOut } = useSessionBridge();
  const [railPreviewOpen, setRailPreviewOpen] = React.useState(false);
  const projectsQuery = useStage15Projects();
  const projects = projectsQuery.data?.items ?? [];
  const firstProjectId = projects[0]?.id ?? fallbackProjectId;
  const activeProjectIdFromPath = readProjectIdFromPath(pathname);
  const storedActiveProjectId = useStage15ShellStore((state) => state.activeProjectId);
  const activeProjectId =
    activeProjectIdFromPath ?? storedActiveProjectId ?? firstProjectId;
  const setActiveProjectId = useStage15ShellStore((state) => state.setActiveProjectId);
  const storedCollapsed = useStage15ShellStore((state) => state.sidebarCollapsed);
  const setCollapsed = useStage15ShellStore((state) => state.setSidebarCollapsed);
  const collapsed = forceCollapsed || storedCollapsed;
  const expandedProjectIds = useStage15ShellStore((state) => state.expandedProjectIds);
  const toggleProject = useStage15ShellStore((state) => state.toggleProject);
  const permissions = new Set(sessionContext.permissions);
  const canViewDashboard = permissions.has("dashboard.view");
  const notifications = useNotifications(
    { limit: 50, status: "unread" },
    { enabled: canViewDashboard },
  );
  const notificationCounts = React.useMemo(
    () => countSidebarNotifications(notifications.data?.items ?? []),
    [notifications.data?.items],
  );
  const createChat = useCreateStage15ProjectChat(activeProjectId);
  const projectChatsQuery = useStage15ProjectChats(activeProjectId);
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const firstProjectChat = projectChatsQuery.data?.[0] ?? null;
  const activeProjectHref = `/app/projects/${activeProjectId}`;
  const activeProjectChatsHref = firstProjectChat
    ? `/app/projects/${firstProjectChat.projectId}/chats/${firstProjectChat.id}`
    : activeProjectHref;
  const activeProjectAutomationsHref = `${activeProjectHref}/automations`;
  const isProjectRoute =
    pathname.startsWith(activeProjectHref) &&
    !pathname.startsWith(`${activeProjectHref}/chats`) &&
    !pathname.startsWith(activeProjectAutomationsHref);

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

  const navItems = [
    {
      href: "/app",
      icon: <Home size={18} />,
      label: "Главная",
      active: pathname === "/app",
      badge: 0,
    },
    {
      href: activeProjectChatsHref,
      icon: <MessageSquare size={18} />,
      label: "Чаты",
      active: pathname.startsWith(`${activeProjectHref}/chats`),
      badge: notificationCounts.chat,
    },
    {
      href: activeProjectHref,
      icon: <FolderOpen size={18} />,
      label: "Проекты",
      active: isProjectRoute,
      badge: 0,
    },
    {
      href: activeProjectAutomationsHref,
      icon: <Workflow size={18} />,
      label: "Автоматизации",
      active: pathname.startsWith(activeProjectAutomationsHref),
      badge: notificationCounts.automation,
    },
  ];

  if (collapsed) {
    return (
      <>
        <aside className="sidebar-sheen relative w-[88px] shrink-0 overflow-hidden px-4 py-5">
          <div className="noise-overlay absolute inset-0" />
          <div className="relative grid h-full min-h-screen grid-rows-[auto_1fr_auto] justify-items-center gap-4">
            <div className="grid justify-items-center gap-3">
              <RailLink href="/app" label="Pravacontour">
                <span className="font-[family-name:var(--font-display)] text-lg">P</span>
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
                <ChevronRight size={18} />
              </RailButton>
              <RailButton
                label="Новый чат"
                onClick={() => void handleCreateChat()}
                primary
                disabled={createChat.isPending || !activeProjectId}
              >
                <Plus size={20} />
              </RailButton>
              <RailButton label="Поиск">
                <Search size={18} />
              </RailButton>
            </div>

            <nav className="grid content-start justify-items-center gap-3">
              {navItems.map((item) => (
                <RailLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  active={item.active}
                  badge={item.badge}
                >
                  {item.icon}
                </RailLink>
              ))}
            </nav>

            <RailButton
              label="Выйти"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut size={18} />
            </RailButton>
          </div>
        </aside>

        {forceCollapsed && railPreviewOpen ? (
          <div className="fixed bottom-5 left-[104px] top-5 z-50 w-[310px] rounded-[28px] border border-[color:var(--line)] bg-[color:var(--panel)]/98 p-4 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-display)] text-xl">Pravacontour</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {sessionContext.activeWorkspace?.name ?? "Workspace"}
                </div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
                onClick={() => setRailPreviewOpen(false)}
                aria-label="Закрыть меню"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-2">
              {navItems.map((item) => (
                <SidebarLink
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={item.active}
                  collapsed={false}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <aside className="sidebar-sheen relative w-[320px] shrink-0 overflow-hidden px-5 py-6 transition-[width] duration-200">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative flex h-full min-h-screen flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/app"
            className="flex min-w-0 items-center gap-3 rounded-[18px] border border-transparent px-2 py-2 hover:border-[color:var(--line)]"
            aria-label="Pravacontour"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 font-[family-name:var(--font-display)] text-lg text-[color:var(--accent-strong)]">
              P
            </div>
            <div className="min-w-0">
              <div className="truncate font-[family-name:var(--font-display)] text-xl">
                Pravacontour
              </div>
              <div className="truncate text-xs text-[color:var(--muted)]">
                {sessionContext.activeWorkspace?.name ?? "Workspace"}
              </div>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Свернуть меню"
            onClick={() => setCollapsed(true)}
            className="h-9 w-9 px-0"
          >
            <PanelLeftClose size={16} />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => void handleCreateChat()}
            disabled={createChat.isPending || !activeProjectId}
            className="w-full justify-start"
            aria-label="Новый чат"
          >
            <Plus size={16} />
            <span>Новый чат</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            aria-label="Поиск"
          >
            <Search size={16} />
            <span>Поиск</span>
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={item.active}
                collapsed={false}
                badge={item.badge}
              />
            ))}
          </div>

          <div className="grid gap-2">
            {projects.length === 0 && projectsQuery.isLoading ? (
              <CompactMuted text="..." />
            ) : null}
            {projects.map((project) => (
              <ProjectTreeItem
                key={project.id}
                project={project}
                activeProjectId={activeProjectId}
                expanded={
                  expandedProjectIds.includes(project.id) ||
                  project.id === activeProjectId
                }
                pathname={pathname}
                onToggle={() => toggleProject(project.id)}
              />
            ))}
          </div>
        </nav>

        <div className="grid gap-3">
          {activeProject ? (
            <div className="rounded-[20px] border border-[color:var(--line)] bg-white/4 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Активный проект
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-medium">
                {activeProject.name}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={activeProject.status === "active" ? "success" : "muted"}>
                  {formatStatus(activeProject.status)}
                </Badge>
                {activeProject.counters.pendingApprovals > 0 ? (
                  <Badge variant="accent">
                    {activeProject.counters.pendingApprovals} approvals
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}
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
        </div>
      </div>
    </aside>
  );
}

function ProjectTreeItem({
  project,
  activeProjectId,
  expanded,
  pathname,
  onToggle,
}: {
  readonly project: Stage15ProjectSummary;
  readonly activeProjectId: string;
  readonly expanded: boolean;
  readonly pathname: string;
  readonly onToggle: () => void;
}) {
  const projectHref = `/app/projects/${project.id}`;
  const active = activeProjectId === project.id;

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-black/20 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-[12px] text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
          onClick={onToggle}
          aria-label={expanded ? "Свернуть проект" : "Развернуть проект"}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <Link
          href={projectHref}
          className={cn(
            "min-w-0 flex-1 rounded-[14px] px-2 py-2 text-sm transition",
            active
              ? "bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
              : "text-[color:var(--muted)] hover:bg-white/4 hover:text-[color:var(--foreground)]",
          )}
        >
          <div className="truncate font-medium">{project.name}</div>
          <div className="mt-1 truncate text-xs text-[color:var(--muted)]">
            {project.counters.chats} чатов / {project.counters.automations} автоматизаций
          </div>
        </Link>
      </div>
      {expanded ? (
        <div className="mt-2 grid gap-1 pl-10">
          <SidebarLink
            href={`${projectHref}/chats/chat_project_claim_001`}
            icon={<MessageSquare size={15} />}
            label="Чаты"
            active={pathname.startsWith(`${projectHref}/chats`)}
            collapsed={false}
          />
          <SidebarLink
            href={`${projectHref}/automations`}
            icon={<Workflow size={15} />}
            label="Автоматизации"
            active={pathname.startsWith(`${projectHref}/automations`)}
            collapsed={false}
          />
          <SidebarLink
            href={`${projectHref}#documents`}
            icon={<FileText size={15} />}
            label="Документы"
            active={false}
            collapsed={false}
          />
        </div>
      ) : null}
    </div>
  );
}

function RailLink({
  active,
  badge,
  children,
  href,
  label,
}: {
  readonly active?: boolean;
  readonly badge?: number;
  readonly children: React.ReactNode;
  readonly href: string;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-[18px] border text-[color:var(--muted)] transition",
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
          : "border-transparent hover:border-[color:var(--line)] hover:bg-white/4 hover:text-[color:var(--foreground)]",
      )}
      aria-label={label}
      title={label}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] ring-2 ring-[color:var(--background)]" />
      ) : null}
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
          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-strong)]"
          : "border-transparent text-[color:var(--muted)] hover:border-[color:var(--line)] hover:bg-white/4 hover:text-[color:var(--foreground)]",
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

function SidebarLink({
  href,
  icon,
  label,
  active,
  collapsed,
  badge,
}: {
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly badge?: number;
}) {
  const hasBadge = Boolean(badge && badge > 0);

  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-[16px] border px-3 py-2 text-sm transition",
        collapsed ? "w-10 justify-center px-0" : "",
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
          : "border-transparent text-[color:var(--muted)] hover:border-[color:var(--line)] hover:bg-white/4 hover:text-[color:var(--foreground)]",
      )}
      aria-label={collapsed ? label : undefined}
    >
      {icon}
      {collapsed && hasBadge ? (
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] ring-2 ring-[color:var(--background)]" />
      ) : null}
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {hasBadge ? <Badge variant="accent">{badge}</Badge> : null}
        </>
      ) : null}
    </Link>
  );
}

function CompactMuted({ text }: { readonly text: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--line)] bg-white/4 px-3 py-2 text-xs text-[color:var(--muted)]">
      {text}
    </div>
  );
}

function readProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/app\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}
