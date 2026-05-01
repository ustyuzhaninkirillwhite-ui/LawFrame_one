"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import { ProjectSidebar } from "@/components/shell/project-sidebar";
import {
  isAutomationCanvasRoute,
  isProjectWorkspaceRoute,
} from "@/lib/automation-canvas-route";
import { cn } from "@/lib/utils";
import { SystemStatusBanner } from "./system-status-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const canvasMode = isAutomationCanvasRoute(pathname);
  const projectWorkspaceMode = isProjectWorkspaceRoute(pathname);

  return (
    <div className="flex min-h-screen bg-[color:var(--lf-bg-app)]">
      <ProjectSidebar forceCollapsed={false} />
      <main
        className={cn(
          "min-w-0 flex-1",
          canvasMode ? "h-screen overflow-hidden" : "px-4 py-4 lg:px-7 lg:py-7",
        )}
      >
        {canvasMode ? (
          children
        ) : (
          <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-[1520px] flex-col gap-6 rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-5 shadow-[var(--lf-shadow-panel)] lg:p-6">
            {projectWorkspaceMode ? null : <SystemStatusBanner />}
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
