import { Wrench } from "lucide-react";

export function LexFrameToolCard({
  title,
  status,
}: {
  readonly title: string;
  readonly status: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-slate-800">
        <Wrench className="h-4 w-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-1 text-slate-600">{status}</div>
    </div>
  );
}
