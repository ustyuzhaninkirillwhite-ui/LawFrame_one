"use client";

import { useSystemStatus } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/i18n";

const statusLabels: Record<string, string> = {
  ai: "ИИ ограничен",
  storage: "Хранилище ограничено",
  activepieces: "Activepieces ограничен",
  search: "Поиск ограничен",
  realtime: "Realtime ограничен",
};

export function SystemStatusBanner() {
  const systemStatus = useSystemStatus();

  if (!systemStatus.data || systemStatus.data.overall === "healthy") {
    return null;
  }

  const affected = systemStatus.data.components.filter(
    (component) => component.status !== "healthy",
  );

  if (affected.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[26px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(221,184,120,0.14),rgba(255,255,255,0.03)_52%,rgba(0,0,0,0.18))] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
            ограниченный режим
          </div>
          <div className="mt-2 text-sm text-[color:var(--foreground)]">
            {systemStatus.data.summary}
          </div>
        </div>
        <Badge
          variant={
            systemStatus.data.overall === "blocked" ? "danger" : "accent"
          }
        >
          {formatStatus(systemStatus.data.overall)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {affected.map((component) => (
          <Badge
            key={component.code}
            variant={component.status === "blocked" ? "danger" : "muted"}
          >
            {statusLabels[component.code] ?? component.code}
          </Badge>
        ))}
      </div>
    </div>
  );
}
