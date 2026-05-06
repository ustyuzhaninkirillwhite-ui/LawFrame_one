"use client";

import { Button } from "@/components/ui/button";

export type AutomationCanvasTab =
  | "activepieces_canvas"
  | "reserve_canvas"
  | "runs"
  | "settings"
  | "diagnostics";

const tabs: readonly {
  readonly id: AutomationCanvasTab;
  readonly label: string;
}[] = [
  { id: "activepieces_canvas", label: "Конструктор" },
  { id: "reserve_canvas", label: "LexFrame Canvas (резерв)" },
  { id: "runs", label: "Запуски" },
  { id: "settings", label: "Настройки" },
  { id: "diagnostics", label: "Диагностика" },
];

export function AutomationTabs({
  reserveCanvasEnabled,
  selectedTab,
  onSelectTab,
}: {
  readonly reserveCanvasEnabled: boolean;
  readonly selectedTab: AutomationCanvasTab;
  readonly onSelectTab: (tab: AutomationCanvasTab) => void;
}) {
  const availableTabs = reserveCanvasEnabled
    ? tabs
    : tabs.filter((tab) => tab.id !== "reserve_canvas");

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Разделы автоматизации"
    >
      {availableTabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={selectedTab === tab.id ? "ap" : "ghost"}
          role="tab"
          aria-selected={selectedTab === tab.id}
          aria-controls={`automation-panel-${tab.id}`}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
