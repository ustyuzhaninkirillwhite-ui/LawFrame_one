"use client";

import type {
  CanvasModuleCard,
  CanvasModuleCatalogResponse,
  ModuleAvailabilityStatus,
} from "@lexframe/contracts";
import {
  Archive,
  Bot,
  CircleStop,
  Clock,
  Combine,
  FileText,
  Files,
  GitBranch,
  Mail,
  Play,
  Repeat2,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const iconByCategory = {
  start_trigger: Play,
  legal_action: Search,
  ai_action: Bot,
  document_data_input: Files,
  condition_router: GitBranch,
  loop_batch: Repeat2,
  merge: Combine,
  human_approval: ShieldCheck,
  wait_pause: Clock,
  delivery: Mail,
  storage_artifact: Archive,
  subworkflow: Workflow,
  error_handler: TriangleAlert,
  note_group: StickyNote,
  end_output: CircleStop,
} as const;

export function ModulePalette({
  catalog,
  readOnly,
  onAdd,
}: {
  readonly catalog: CanvasModuleCatalogResponse;
  readonly readOnly: boolean;
  readonly onAdd: (module: CanvasModuleCard, source: "palette" | "recommended") => void;
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [detail, setDetail] = React.useState<CanvasModuleCard | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const recommendedCodes = new Set(
    catalog.recommended.map((item) => item.module_code),
  );
  const filtered = catalog.modules.filter((module) => {
    const matchesCategory =
      category === "all" || module.category_code === category;
    const haystack = [
      module.display_name,
      module.short_description,
      module.module_code,
      module.category_label,
      ...module.tags,
      ...module.aliases,
      ...module.input_summary.map((item) => item.label),
      ...module.output_summary.map((item) => item.label),
    ]
      .join(" ")
      .toLocaleLowerCase("ru-RU");
    return (
      matchesCategory &&
      (normalizedQuery.length === 0 || haystack.includes(normalizedQuery))
    );
  });
  const recommendedModules = catalog.modules.filter((module) =>
    recommendedCodes.has(module.module_code),
  );

  return (
    <aside className="flex min-h-0 flex-col border-r border-[color:var(--line)] bg-[#0d1118]/92">
      <div className="border-b border-[color:var(--line)] p-4">
        <Badge variant="muted">Каталог модулей</Badge>
        <h2 className="mt-3 text-sm font-semibold">Юридические блоки Canvas</h2>
        <input
          aria-label="Поиск по каталогу юридических блоков Canvas"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск: претензия, практика, согласовать"
          className="mt-3 h-9 w-full rounded-[8px] border border-[color:var(--line)] bg-black/20 px-3 text-sm outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-[color:var(--line)] p-3">
        <Button
          type="button"
          variant={category === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCategory("all")}
        >
          Все
        </Button>
        {catalog.categories.map((item) => (
          <Button
            key={item.code}
            type="button"
            variant={category === item.code ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategory(item.code)}
            title={item.description}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {recommendedModules.length > 0 && normalizedQuery.length === 0 ? (
        <section className="border-b border-[color:var(--line)] p-3">
          <div className="mb-2 text-xs font-medium text-[color:var(--muted)]">
            Рекомендуемые
          </div>
          <div className="flex flex-col gap-2">
            {recommendedModules.slice(0, 3).map((module) => (
              <ModuleCard
                key={module.module_code}
                module={module}
                readOnly={readOnly}
                compact
                onAdd={() => onAdd(module, "recommended")}
                onDetail={() => setDetail(module)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {filtered.map((module) => (
          <ModuleCard
            key={module.module_code}
            module={module}
            readOnly={readOnly}
            onAdd={() => onAdd(module, "palette")}
            onDetail={() => setDetail(module)}
          />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3 text-sm text-[color:var(--muted)]">
            Ничего не найдено.
          </div>
        ) : null}
      </div>

      <div className="border-t border-[color:var(--line)] p-3 text-xs leading-5 text-[color:var(--muted)]">
        LexFrame проверяет права, совместимость, подключения и политики до добавления блока.
      </div>

      {detail ? (
        <ModuleDetailDrawer
          module={detail}
          readOnly={readOnly}
          onClose={() => setDetail(null)}
          onAdd={() => onAdd(detail, "palette")}
        />
      ) : null}
    </aside>
  );
}

function ModuleCard({
  module,
  readOnly,
  compact = false,
  onAdd,
  onDetail,
}: {
  readonly module: CanvasModuleCard;
  readonly readOnly: boolean;
  readonly compact?: boolean;
  readonly onAdd: () => void;
  readonly onDetail: () => void;
}) {
  const Icon =
    iconByCategory[module.category_code as keyof typeof iconByCategory] ??
    FileText;
  const disabled = readOnly || !canAddModule(module.availability.status);

  return (
    <div
      className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3"
      draggable={!disabled}
      onDragStart={(event) => {
        if (disabled) {
          return;
        }
        event.dataTransfer.setData(
          "application/x-lexframe-module",
          module.module_code,
        );
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-[color:var(--line)] bg-black/20">
          <Icon aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-label={`Подробнее о блоке: ${module.display_name}`}
            className="block w-full text-left text-sm font-medium hover:text-[color:var(--accent)]"
            onClick={onDetail}
          >
            {module.display_name}
          </button>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
            {module.short_description}
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
          <IoSummary label="Нужно" values={module.input_summary.map((item) => item.label)} />
          <IoSummary label="Создаёт" values={module.output_summary.map((item) => item.label)} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        <Badge variant={riskVariant(module.risk_level)}>
          риск: {riskLabel(module.risk_level)}
        </Badge>
        {module.flags.uses_ai ? (
          <Badge variant="accent">
            <Sparkles aria-hidden className="mr-1 size-3" />
            AI
          </Badge>
        ) : null}
        {module.flags.requires_approval ? (
          <Badge variant="accent">согласование</Badge>
        ) : null}
        {module.flags.requires_connection ? (
          <Badge variant="muted">подключение</Badge>
        ) : null}
        <ModuleAvailabilityBadge status={module.availability.status} />
      </div>

      {module.availability.human_reason ? (
        <div className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
          {module.availability.human_reason}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={disabled}
          onClick={onAdd}
          aria-label={`Добавить блок: ${module.display_name}`}
        >
          Добавить
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDetail}
          aria-label={`Подробнее о блоке: ${module.display_name}`}
        >
          Подробнее
        </Button>
      </div>
    </div>
  );
}

function ModuleDetailDrawer({
  module,
  readOnly,
  onClose,
  onAdd,
}: {
  readonly module: CanvasModuleCard;
  readonly readOnly: boolean;
  readonly onClose: () => void;
  readonly onAdd: () => void;
}) {
  const disabled = readOnly || !canAddModule(module.availability.status);
  return (
    <div className="fixed inset-y-0 left-0 z-50 w-full max-w-md border-r border-[color:var(--line)] bg-[#0d1118] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="muted">{module.category_label}</Badge>
          <h3 className="mt-3 text-lg font-semibold">{module.display_name}</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={`Закрыть описание блока: ${module.display_name}`}
        >
          <X aria-hidden />
        </Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
        {module.long_description ?? module.short_description}
      </p>

      <DetailSection title="Входы">
        {module.input_summary.length === 0
          ? "Не требуются."
          : module.input_summary
              .map((item) => `${item.label}${item.required ? " *" : ""}`)
              .join(", ")}
      </DetailSection>
      <DetailSection title="Выходы">
        {module.output_summary.length === 0
          ? "Нет результата для следующих шагов."
          : module.output_summary.map((item) => item.label).join(", ")}
      </DetailSection>
      <DetailSection title="Требования">
        {module.requirements.length === 0
          ? "Нет дополнительных требований."
          : module.requirements.map((item) => item.label).join(", ")}
      </DetailSection>
      <DetailSection title="Риски">
        {[
          riskLabel(module.risk_level),
          module.flags.uses_ai ? "использует AI" : null,
          module.flags.external_action ? "внешнее действие" : null,
          module.flags.requires_approval ? "требует согласования" : null,
        ]
          .filter(Boolean)
          .join(", ")}
      </DetailSection>

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          aria-label={`Добавить блок: ${module.display_name}`}
        >
          Добавить блок
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
}

function IoSummary({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}) {
  if (values.length === 0) {
    return null;
  }
  return (
    <div>
      <span className="font-medium text-[#f5f2ea]">{label}: </span>
      <span>{values.slice(0, 3).join(", ")}</span>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h4 className="text-xs font-semibold uppercase text-[color:var(--muted)]">
        {title}
      </h4>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </section>
  );
}

function ModuleAvailabilityBadge({
  status,
}: {
  readonly status: ModuleAvailabilityStatus;
}) {
  const danger = [
    "blocked_by_role",
    "blocked_by_plan",
    "blocked_by_data_policy",
    "blocked_by_runtime",
    "deprecated",
    "retired",
    "incompatible_with_canvas_context",
  ].includes(status);
  return <Badge variant={danger ? "danger" : "muted"}>{availabilityLabel(status)}</Badge>;
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

function riskVariant(risk: CanvasModuleCard["risk_level"]) {
  return risk === "critical" || risk === "high" ? "danger" : "muted";
}

function riskLabel(risk: CanvasModuleCard["risk_level"]) {
  const labels = {
    low: "низкий",
    medium: "средний",
    high: "высокий",
    critical: "критический",
  } as const;
  return labels[risk];
}

function availabilityLabel(status: ModuleAvailabilityStatus) {
  const labels: Record<ModuleAvailabilityStatus, string> = {
    available: "доступен",
    available_with_warnings: "есть предупреждения",
    missing_required_input: "нет входных данных",
    missing_connection: "нет подключения",
    missing_profile: "нет профиля",
    missing_template: "нет шаблона",
    blocked_by_role: "нет прав",
    blocked_by_plan: "недоступно в тарифе",
    blocked_by_data_policy: "блокируется политикой данных",
    blocked_by_runtime: "исполнение недоступно",
    deprecated: "устарел",
    retired: "выведен",
    incompatible_with_canvas_context: "нельзя вставить здесь",
  };
  return labels[status];
}
