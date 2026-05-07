import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LexFrameToolCard({
  title,
  status,
  actions = [],
}: {
  readonly title: string;
  readonly status: string;
  readonly actions?: readonly {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly onClick: () => void;
  }[];
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-slate-800">
        <Wrench className="h-4 w-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-1 text-slate-600">{status}</div>
      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
