"use client";

import { ChevronDown } from "lucide-react";
import { formatRole } from "@/lib/i18n";
import { useSessionBridge } from "@/providers/session-provider";
import { Button } from "./ui/button";

export function WorkspaceSwitcher() {
  const { sessionContext, switchWorkspace } = useSessionBridge();
  const activeWorkspace = sessionContext.activeWorkspace;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
        Контекст пространства
      </div>
      <div className="rounded-[26px] border border-[color:var(--line)] bg-white/4 p-2">
        <div className="flex items-center justify-between rounded-[20px] bg-black/25 px-4 py-3">
          <div>
            <div className="font-medium text-[color:var(--foreground)]">
              {activeWorkspace.name}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              {activeWorkspace.slug}
            </div>
          </div>
          <ChevronDown className="size-4 text-[color:var(--accent)]" />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {sessionContext.workspaces.map((workspace) => (
            <Button
              key={workspace.id}
              variant={
                workspace.id === activeWorkspace.id ? "default" : "ghost"
              }
              size="sm"
              className="justify-between"
              onClick={() => {
                void switchWorkspace(workspace.id);
              }}
            >
              <span>{workspace.name}</span>
              <span className="text-[10px] uppercase tracking-[0.22em]">
                {formatRole(workspace.role)}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
