"use client";

import type {
  CanvasValidationIssueExplanation,
  CanvasValidationSummary,
  SuggestedFix,
  ValidationIssue,
} from "@lexframe/contracts";
import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCanvasUiStore } from "../store";

export function ValidationRail({
  validation,
  onExplainIssue,
  onApplySuggestedFix,
  onFixIssueWithAi,
}: {
  readonly validation: CanvasValidationSummary;
  readonly onExplainIssue?: (
    issueId: string,
  ) => Promise<CanvasValidationIssueExplanation>;
  readonly onApplySuggestedFix?: (
    issueId: string,
    suggestedFixId: string,
    confirmed: boolean,
  ) => Promise<void>;
  readonly onFixIssueWithAi?: (issueId: string) => Promise<void>;
}) {
  const setSelectedNode = useCanvasUiStore((state) => state.setSelectedNode);
  const setSelectedEdge = useCanvasUiStore((state) => state.setSelectedEdge);
  const groups = buildIssueGroups(validation.issues);
  const blockedActions = blockedActionLabels(validation);

  return (
    <section className="border-t border-[color:var(--line)] bg-[#0d1118]/92 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={validation.status === "invalid" ? "danger" : "success"}>
          {validationStatusLabel(validation.status)}
        </Badge>
        <Badge variant="muted">ошибки {validation.errors_count}</Badge>
        <Badge variant="muted">предупреждения {validation.warnings_count}</Badge>
        <Badge variant="muted">политики {validation.policy_blocks_count}</Badge>
        {blockedActions.map((action) => (
          <Badge key={action} variant="danger">
            блокирует: {actionLabel(action)}
          </Badge>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {groups.map((group) => {
          const Icon = group.hasPolicyBlock ? ShieldAlert : AlertTriangle;
          return (
            <div
              key={group.key}
              className="min-w-0 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-[color:var(--muted)]">
                  <Icon aria-hidden className="size-3" />
                  {group.label}
                </div>
                <Badge variant={group.issues.length > 0 ? "danger" : "muted"}>
                  {group.issues.length}
                </Badge>
              </div>
              <div className="mt-3 flex max-h-36 gap-2 overflow-x-auto pb-1">
                {group.issues.length === 0 ? (
                  <div className="flex min-w-[220px] items-center gap-2 rounded-[8px] border border-[color:var(--line)] bg-black/15 p-3 text-sm text-[color:var(--muted)]">
                    <CheckCircle2 aria-hidden className="size-4" />
                    Нет замечаний.
                  </div>
                ) : (
                  group.issues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onFocus={() => {
                        if (issue.affected_node_id) {
                          setSelectedNode(issue.affected_node_id);
                        } else if (issue.affected_edge_id) {
                          setSelectedEdge(issue.affected_edge_id);
                        }
                      }}
                      onExplainIssue={onExplainIssue}
                      onApplySuggestedFix={onApplySuggestedFix}
                      onFixIssueWithAi={onFixIssueWithAi}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IssueCard({
  issue,
  onFocus,
  onExplainIssue,
  onApplySuggestedFix,
  onFixIssueWithAi,
}: {
  readonly issue: ValidationIssue;
  readonly onFocus: () => void;
  readonly onExplainIssue?: (
    issueId: string,
  ) => Promise<CanvasValidationIssueExplanation>;
  readonly onApplySuggestedFix?: (
    issueId: string,
    suggestedFixId: string,
    confirmed: boolean,
  ) => Promise<void>;
  readonly onFixIssueWithAi?: (issueId: string) => Promise<void>;
}) {
  const [explanation, setExplanation] =
    React.useState<CanvasValidationIssueExplanation | null>(null);
  const [explaining, setExplaining] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [fixingWithAi, setFixingWithAi] = React.useState(false);
  const suggestedFix = firstAutomaticFix(issue.suggested_fixes ?? []);
  const noCode = explanation?.no_code ?? null;

  async function explain() {
    if (!onExplainIssue) {
      return;
    }
    setExplaining(true);
    try {
      setExplanation(await onExplainIssue(issue.id));
    } finally {
      setExplaining(false);
    }
  }

  async function applyFix(fix: SuggestedFix) {
    if (!onApplySuggestedFix) {
      return;
    }
    const needsConfirmation = Boolean(
      fix.requires_confirmation || fix.sensitive || fix.destructive,
    );
    const confirmed =
      !needsConfirmation ||
      window.confirm(`Применить исправление: ${fix.label}?`);
    if (!confirmed) {
      return;
    }
    setApplying(true);
    try {
      await onApplySuggestedFix(issue.id, fix.id, needsConfirmation);
    } finally {
      setApplying(false);
    }
  }

  async function fixWithAi() {
    if (!onFixIssueWithAi) {
      return;
    }
    setFixingWithAi(true);
    try {
      await onFixIssueWithAi(issue.id);
    } finally {
      setFixingWithAi(false);
    }
  }

  return (
    <div className="min-w-[280px] rounded-[8px] border border-[color:var(--line)] bg-black/15 p-3">
      <button type="button" className="block w-full text-left" onClick={onFocus}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={issue.severity === "warning" ? "muted" : "danger"}>
            {severityLabel(issue.severity)}
          </Badge>
          {issue.category ? <Badge variant="muted">{categoryLabel(issue.category)}</Badge> : null}
        </div>
        <div className="mt-2 line-clamp-1 text-sm font-medium">
          {noCode?.title ?? issue.title}
        </div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
          {noCode?.plain_language_message ?? issue.message}
        </div>
      </button>
      {issue.blocks && issue.blocks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.blocks.map((block) => (
            <Badge key={block} variant="danger">
              блокирует: {actionLabel(block)}
            </Badge>
          ))}
        </div>
      ) : null}
      {explanation ? (
        <div className="mt-2 rounded-[6px] border border-[color:var(--line)] bg-black/20 p-2 text-xs leading-5 text-[color:var(--muted)]">
          {noCode ? (
            <>
              <div>{noCode.why_it_matters}</div>
              {noCode.how_to_fix.length > 0 ? (
                <div className="mt-1 text-[color:var(--muted-strong)]">
                  Что сделать: {noCode.how_to_fix.join("; ")}
                </div>
              ) : null}
            </>
          ) : (
            explanation.plain_explanation
          )}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {onExplainIssue ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={explain}
            disabled={explaining}
          >
            <CircleHelp aria-hidden data-icon="inline-start" />
            Объяснить
          </Button>
        ) : null}
        {suggestedFix && onApplySuggestedFix ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void applyFix(suggestedFix)}
            disabled={applying}
          >
            <Wrench aria-hidden data-icon="inline-start" />
            {suggestedFix.label}
          </Button>
        ) : null}
        {onFixIssueWithAi ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void fixWithAi()}
            disabled={fixingWithAi}
          >
            <Sparkles aria-hidden data-icon="inline-start" />
            Исправить с AI
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function buildIssueGroups(issues: readonly ValidationIssue[]) {
  const categories = [
    "structure",
    "schema",
    "type_compatibility",
    "semantic",
    "security",
    "policy",
    "runtime",
    "ux",
    "performance",
  ] as const;
  return categories.map((category) => {
    const categoryIssues = issues
      .filter((issue) => (issue.category ?? "ux") === category)
      .sort(compareIssues);
    return {
      key: category,
      label: categoryLabel(category),
      hasPolicyBlock: categoryIssues.some(
        (issue) => issue.severity === "policy_block",
      ),
      issues: categoryIssues,
    };
  });
}

function validationStatusLabel(status: CanvasValidationSummary["status"]) {
  const labels: Record<string, string> = {
    valid: "готово",
    valid_with_warnings: "есть предупреждения",
    invalid: "есть ошибки",
  };
  return labels[status] ?? status;
}

function severityLabel(severity: ValidationIssue["severity"]) {
  const labels: Record<ValidationIssue["severity"], string> = {
    info: "информация",
    warning: "предупреждение",
    error: "ошибка",
    policy_block: "блокирует",
  };
  return labels[severity] ?? severity;
}

function categoryLabel(category: ValidationIssue["category"]) {
  switch (category) {
    case "structure":
      return "структура";
    case "schema":
      return "настройки";
    case "type_compatibility":
      return "данные";
    case "semantic":
      return "юридическая логика";
    case "security":
      return "безопасность";
    case "policy":
      return "политики";
    case "runtime":
      return "исполнение";
    case "ux":
      return "удобство";
    case "performance":
      return "производительность";
    default:
      return category ?? "удобство";
  }
}

function compareIssues(a: ValidationIssue, b: ValidationIssue) {
  const severityOrder = { policy_block: 0, error: 1, warning: 2, info: 3 };
  return (
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.code.localeCompare(b.code) ||
    a.id.localeCompare(b.id)
  );
}

function firstAutomaticFix(fixes: readonly SuggestedFix[]) {
  return fixes.find((fix) => fix.operation_type && fix.operation_payload) ?? null;
}

function blockedActionLabels(validation: CanvasValidationSummary) {
  const capabilities = validation.capabilities ?? validation;
  return [
    capabilities.can_save ? null : "save",
    capabilities.can_test ? null : "test",
    capabilities.can_compile ? null : "compile",
    capabilities.can_publish ? null : "publish",
    capabilities.can_run ? null : "run",
  ].filter((item): item is string => Boolean(item));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    save: "сохранение",
    test: "проверку",
    compile: "подготовку к публикации",
    publish: "публикацию",
    run: "запуск",
  };
  return labels[action] ?? action;
}
