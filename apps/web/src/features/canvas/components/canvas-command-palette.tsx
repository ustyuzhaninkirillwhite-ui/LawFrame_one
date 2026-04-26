"use client";

import type {
  CanvasModuleCard,
  ModuleAvailabilityStatus,
} from "@lexframe/contracts";
import { Search, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CanvasCommandPalette({
  open,
  modules,
  readOnly,
  onClose,
  onAddModule,
  onValidate,
  onAutoLayout,
}: {
  readonly open: boolean;
  readonly modules: readonly CanvasModuleCard[];
  readonly readOnly: boolean;
  readonly onClose: () => void;
  readonly onAddModule: (module: CanvasModuleCard) => void;
  readonly onValidate: () => void;
  readonly onAutoLayout: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const handleClose = () => {
    setQuery("");
    onClose();
  };

  if (!open) {
    return null;
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const filteredModules = modules
    .filter((module) => canAddModule(module.availability.status))
    .filter((module) =>
      normalizedQuery.length === 0
        ? true
        : [
            module.display_name,
            module.short_description,
            module.module_code,
            module.category_label,
            ...module.aliases,
            ...module.tags,
          ]
            .join(" ")
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery),
    )
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/45 px-4 pt-[12vh]">
      <div className="mx-auto w-full max-w-2xl rounded-[8px] border border-[color:var(--line)] bg-[#0d1118] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <Search aria-hidden className="size-4 text-[color:var(--muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Команда или блок"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <Button type="button" size="sm" variant="ghost" onClick={handleClose}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            <PaletteCommand
              label="Проверить граф"
              onClick={() => {
                onValidate();
                handleClose();
              }}
            />
            <PaletteCommand
              label="Авто-раскладка"
              onClick={() => {
                onAutoLayout();
                handleClose();
              }}
            />
          </div>
          <div className="space-y-2">
            <Badge variant="muted">Модули</Badge>
            {filteredModules.length === 0 ? (
              <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm text-[color:var(--muted)]">
                Ничего не найдено.
              </div>
            ) : (
              filteredModules.map((module) => (
                <button
                  key={module.module_code}
                  type="button"
                  disabled={readOnly}
                  className="block w-full rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-left hover:border-[color:var(--accent)]"
                  onClick={() => {
                    onAddModule(module);
                    handleClose();
                  }}
                >
                  <span className="block text-sm font-medium">{module.display_name}</span>
                  <span className="mt-1 line-clamp-1 block text-xs text-[color:var(--muted)]">
                    {module.short_description}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function canAddModule(status: ModuleAvailabilityStatus) {
  return [
    "available",
    "available_with_warnings",
    "missing_connection",
    "missing_profile",
    "missing_template",
  ].includes(status);
}

function PaletteCommand({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-[8px] border border-[color:var(--line)] bg-white/4 px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="text-xs text-[color:var(--muted)]">Enter</span>
    </button>
  );
}
