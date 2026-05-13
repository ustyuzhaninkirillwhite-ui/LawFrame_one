import { ChevronLeft, ChevronRight } from "lucide-react";

export function BranchSwitcher({
  ordinal,
  total,
}: {
  readonly ordinal: number;
  readonly total: number;
}) {
  return (
    <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[color:var(--lf-border)] px-1.5 py-0.5 text-[11px] text-[color:var(--lf-text-muted)]">
      <button
        type="button"
        className="rounded-full p-0.5 transition hover:bg-[color:var(--lf-state-hover)]"
        aria-label="Предыдущая ветка"
        disabled={ordinal <= 1}
      >
        <ChevronLeft size={12} aria-hidden="true" />
      </button>
      <span>
        {ordinal} / {total}
      </span>
      <button
        type="button"
        className="rounded-full p-0.5 transition hover:bg-[color:var(--lf-state-hover)]"
        aria-label="Следующая ветка"
        disabled={ordinal >= total}
      >
        <ChevronRight size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
