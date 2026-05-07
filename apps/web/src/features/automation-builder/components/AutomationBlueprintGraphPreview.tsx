import type { AutomationBlueprint } from "../domain/automationBuilderTypes";
import { ArrowRight } from "lucide-react";

export function AutomationBlueprintGraphPreview({
  blueprint,
}: {
  readonly blueprint: AutomationBlueprint;
}) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--panel-muted)] p-4">
      <div className="flex min-w-max items-center gap-3">
        {blueprint.steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className="w-44 rounded-[8px] border border-[color:var(--line)] bg-white p-3">
              <div className="text-xs uppercase text-[color:var(--muted-strong)]">
                {step.kind}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-medium text-[color:var(--text)]">
                {step.title}
              </div>
            </div>
            {index < blueprint.steps.length - 1 ? (
              <ArrowRight className="size-5 text-[color:var(--muted-strong)]" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
