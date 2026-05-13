"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { FloatingAiComposer } from "@/components/shell/floating-ai-composer";
import { ProjectSidebar } from "@/components/shell/project-sidebar";
import { clearActivepiecesBrowserSessionTokens } from "@/features/automation-canvas/activepieces-browser-session";
import {
  isAutomationCanvasRoute,
  isProjectChatRoute,
  isProjectWorkspaceRoute,
} from "@/lib/automation-canvas-route";
import { cn } from "@/lib/utils";
import { SystemStatusBanner } from "./system-status-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const canvasMode = isAutomationCanvasRoute(pathname);
  const automationRouteFamilyMode = Boolean(
    pathname?.match(/^\/app\/projects\/[^/]+\/automations\/[^/]+(?:\/.*)?$/),
  );
  const projectChatMode = isProjectChatRoute(pathname);
  const globalChatMode = Boolean(pathname?.match(/^\/chat(?:\/[^/]+)?\/?$/));
  const projectWorkspaceMode = isProjectWorkspaceRoute(pathname);
  const immersiveProjectMode = projectWorkspaceMode || projectChatMode || globalChatMode;

  React.useEffect(() => {
    if (!automationRouteFamilyMode) {
      clearActivepiecesBrowserSessionTokens();
    }
  }, [automationRouteFamilyMode, pathname]);

  return (
    <div
      className={cn(
        "flex bg-[color:var(--lf-bg-app)]",
        canvasMode || immersiveProjectMode
          ? "h-screen overflow-hidden"
          : "min-h-screen",
      )}
    >
      <ProjectSidebar forceCollapsed={false} />
      <main
        className={cn(
          "min-w-0 flex-1",
          canvasMode || projectChatMode || globalChatMode
            ? "h-screen overflow-hidden"
            : projectWorkspaceMode
              ? "h-screen overflow-y-auto"
              : "px-4 py-4 lg:px-7 lg:py-7",
        )}
      >
        {canvasMode || immersiveProjectMode ? (
          children
        ) : (
          <div
            data-testid="app-shell-panel"
            className="mx-auto flex min-h-[calc(100vh-32px)] max-w-[1520px] flex-col gap-6 rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-5 shadow-[var(--lf-shadow-panel)] lg:p-6"
          >
            <SystemStatusBanner />
            {children}
          </div>
        )}
      </main>
      {immersiveProjectMode ? null : (
        <FloatingAiComposer canvasMode={canvasMode} />
      )}
    </div>
  );
}
