import type { AutomationBlueprintStep } from "@lexframe/contracts";
import { Badge } from "@/components/ui/badge";

export function AutomationBlueprintStepList({
  steps,
}: {
  readonly steps: readonly AutomationBlueprintStep[];
}) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="rounded-[8px] border border-[color:var(--line)] bg-white p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{index + 1}</Badge>
            <Badge variant={step.policy.riskLevel === "high" ? "warning" : "muted"}>
              {step.kind}
            </Badge>
            {step.policy.requiresApproval ? (
              <Badge variant="warning">approval</Badge>
            ) : null}
            {step.policy.externalAction ? (
              <Badge variant="danger">external</Badge>
            ) : null}
          </div>
          <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
            {step.title}
          </div>
          <div className="mt-1 text-sm text-[color:var(--muted-strong)]">
            {step.description}
          </div>
        </div>
      ))}
    </div>
  );
}
