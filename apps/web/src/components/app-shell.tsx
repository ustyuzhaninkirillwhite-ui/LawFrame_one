import type * as React from "react";
import { NavSidebar } from "./nav-sidebar";
import { SystemStatusBanner } from "./system-status-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-grid">
      <NavSidebar />
      <main className="px-5 py-5 lg:px-8 lg:py-8">
        <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-7xl flex-col gap-8 rounded-[34px] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 lg:p-8">
          <SystemStatusBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
