import type { SettingsTab } from "@lexframe/contracts";
import { Bot, Building2, Stethoscope, UserRound } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const tabs: readonly {
  readonly id: SettingsTab;
  readonly label: string;
  readonly icon: React.ReactNode;
}[] = [
  { id: "profile", label: "Профиль", icon: <UserRound size={16} /> },
  { id: "organization", label: "Организация", icon: <Building2 size={16} /> },
  { id: "ai", label: "AI и модели", icon: <Bot size={16} /> },
  { id: "diagnostics", label: "Диагностика", icon: <Stethoscope size={16} /> },
];

export function SettingsSidebarNav({
  activeTab,
  onSelect,
}: {
  readonly activeTab: SettingsTab;
  readonly onSelect: (tab: SettingsTab) => void;
}) {
  return (
    <nav className="grid gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-[var(--lf-radius-control)] px-3 py-2 text-left text-sm transition",
            activeTab === tab.id
              ? "bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]"
              : "text-[color:var(--lf-text-muted)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
          )}
          onClick={() => onSelect(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
