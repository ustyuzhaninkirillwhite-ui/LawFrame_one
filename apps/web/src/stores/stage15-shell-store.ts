"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Stage15ShellState {
  readonly sidebarCollapsed: boolean;
  readonly activeProjectId: string | null;
  readonly expandedProjectIds: readonly string[];
  readonly setSidebarCollapsed: (collapsed: boolean) => void;
  readonly setActiveProjectId: (projectId: string | null) => void;
  readonly toggleProject: (projectId: string) => void;
}

export const useStage15ShellStore = create<Stage15ShellState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeProjectId: null,
      expandedProjectIds: [],
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
      toggleProject: (projectId) =>
        set((state) => {
          const expanded = new Set(state.expandedProjectIds);
          if (expanded.has(projectId)) {
            expanded.delete(projectId);
          } else {
            expanded.add(projectId);
          }

          return { expandedProjectIds: Array.from(expanded) };
        }),
    }),
    {
      name: "lexframe-stage15-shell",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeProjectId: state.activeProjectId,
        expandedProjectIds: state.expandedProjectIds,
      }),
    },
  ),
);
