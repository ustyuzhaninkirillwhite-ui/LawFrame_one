import type { ProjectKnowledgeItem } from "@lexframe/contracts";

export function ProjectContextDrawer({
  items,
}: {
  readonly items: readonly ProjectKnowledgeItem[];
}) {
  return (
    <aside className="hidden w-80 border-l border-slate-200 bg-slate-50 lg:block">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
        Контекст проекта
      </div>
      <div className="space-y-2 p-3">
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">Контекст ещё не добавлен.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded border border-slate-200 bg-white p-2 text-xs">
              <div className="font-medium text-slate-800">{item.sourceType}</div>
              <div className="mt-1 text-slate-500">{item.classification} / {item.mode}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
