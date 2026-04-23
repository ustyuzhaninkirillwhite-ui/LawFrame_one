"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatStatus, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function NavSidebar() {
  const pathname = usePathname();
  const { sessionContext, signOut } = useSessionBridge();
  const permissions = new Set(sessionContext.permissions);
  const canViewDashboard = permissions.has("dashboard.view");
  const notifications = useNotifications(
    { limit: 10, status: "unread" },
    { enabled: canViewDashboard },
  );
  const unreadNotifications = notifications.data?.unreadCount ?? 0;

  const navGroups = [
    {
      href: "/dashboard",
      label: "Dashboard",
      tone: "control room",
      visible: canViewDashboard,
    },
    {
      href: "/notifications",
      label: "Notifications",
      tone: "user inbox",
      visible: canViewDashboard,
    },
    {
      href: "/modules",
      label: "Modules",
      tone: "registry",
      visible: permissions.has("automation.read"),
    },
    {
      href: "/library",
      label: "Library",
      tone: "contracts first",
      visible: permissions.has("automation.read"),
    },
    {
      href: "/library/my",
      label: "My Templates",
      tone: "workspace drafts",
      visible: permissions.has("automation.edit"),
    },
    {
      href: "/automations",
      label: "Automations",
      tone: "workflow draft",
      visible: permissions.has("automation.read"),
    },
    {
      href: "/documents",
      label: "Documents",
      tone: "private artifacts",
      visible: permissions.has("document.read"),
    },
    {
      href: "/settings/profile/personal",
      label: "Profile",
      tone: "personal + team policy",
      visible: permissions.has("profile.read"),
    },
    {
      href: "/settings/documents/templates",
      label: "Doc Templates",
      tone: "typed placeholders",
      visible: permissions.has("document.template.read"),
    },
    {
      href: "/approvals",
      label: "Approvals",
      tone: "manual gate",
      visible:
        permissions.has("approval.task.read") ||
        permissions.has("approval.route.manage"),
    },
    {
      href: "/sources",
      label: "Sources",
      tone: "semantic registry",
      visible: permissions.has("legal_sources.manage"),
    },
    {
      href: "/research",
      label: "Research",
      tone: "cited analysis",
      visible: permissions.has("legal_search.use"),
    },
    {
      href: "/chat",
      label: "AI Chat",
      tone: "disabled by gate",
      visible: true,
    },
    {
      href: "/recommendations",
      label: "Recommendations",
      tone: "advisory only",
      visible: permissions.has("recommendation.read"),
    },
    {
      href: "/workspace/recommendations",
      label: "Workspace Recs",
      tone: "team scope",
      visible: permissions.has("recommendation.manage"),
    },
    {
      href: "/admin/modules",
      label: "Admin / Modules",
      tone: "module registry",
      visible: permissions.has("module.manage"),
    },
    {
      href: "/admin/moderation/publications",
      label: "Admin / Moderation",
      tone: "publication queue",
      visible: permissions.has("moderation.review"),
    },
    {
      href: "/admin/security",
      label: "Admin / Security",
      tone: "release gates",
      visible:
        permissions.has("workspace.security.read") || permissions.has("audit.read"),
    },
    {
      href: "/admin/recommendations",
      label: "Admin / Recommendations",
      tone: "process mining",
      visible: permissions.has("recommendation.manage"),
    },
  ].filter((item) => item.visible);

  return (
    <aside className="sidebar-sheen relative overflow-hidden px-6 py-8">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative flex h-full flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--accent)]">
            LexFrame
          </div>
          <div className="max-w-[14rem] font-[family-name:var(--font-display)] text-4xl leading-none">
            {t("Stage 1 control surface for workspace security.")}
          </div>
          <p className="max-w-[15rem] text-sm leading-6 text-[color:var(--muted)]">
            {t("Backend now owns the session context, workspace boundary, RBAC and audit trail.")}
          </p>
          <Badge variant="accent">{formatStatus(sessionContext.state)}</Badge>
        </div>

        <div className="rounded-[24px] border border-[color:var(--line)] bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
            {t("Actor")}
          </div>
          <div className="mt-3 text-sm text-[color:var(--foreground)]">
            {sessionContext.actor?.fullName ?? sessionContext.actor?.email ?? t("Unknown actor")}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {sessionContext.actor?.email ?? t("No authenticated email")}
          </div>
        </div>

        <WorkspaceSwitcher />

        <nav className="flex flex-col gap-2">
          {navGroups.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group rounded-[22px] border px-4 py-3 transition",
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
                    : "border-transparent bg-transparent text-[color:var(--muted)] hover:border-[color:var(--line)] hover:bg-white/3 hover:text-[color:var(--foreground)]",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{t(item.label)}</div>
                    {item.href === "/notifications" && unreadNotifications > 0 ? (
                      <Badge variant="accent">{unreadNotifications}</Badge>
                    ) : null}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--accent)]/80">
                    {active ? t("open") : t("gate")}
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
                  {t(item.tone)}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] border border-[color:var(--line)] bg-white/4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
            {t("Boundary")}
          </div>
          <div className="mt-3 text-sm leading-6 text-[color:var(--muted-strong)]">
            {t("Browser gets only publishable auth state. Workspace permissions and audit decisions stay on the backend.")}
          </div>
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
