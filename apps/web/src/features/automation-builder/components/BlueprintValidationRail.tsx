import type { AutomationBlueprintValidationSummary } from "../domain/automationBuilderTypes";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeValidation } from "../domain/automationBuilderMappers";

export function BlueprintValidationRail({
  validation,
}: {
  readonly validation: AutomationBlueprintValidationSummary | null;
}) {
  const summary = summarizeValidation(validation);
  const issues = validation
    ? [...validation.policyBlocks, ...validation.errors, ...validation.warnings]
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Validation</CardTitle>
        <Badge variant={summary.status === "policy_blocked" ? "danger" : "muted"}>
          {summary.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[8px] border border-[color:var(--line)] p-3">
            <div className="text-xs text-[color:var(--muted-strong)]">approve</div>
            <div className="font-medium">{String(validation?.canApprove ?? false)}</div>
          </div>
          <div className="rounded-[8px] border border-[color:var(--line)] p-3">
            <div className="text-xs text-[color:var(--muted-strong)]">publish/run</div>
            <div className="font-medium">false / false</div>
          </div>
        </div>
        {issues.map((issue) => (
          <div key={`${issue.code}-${issue.stepId ?? ""}`} className="flex gap-2 text-sm">
            <ShieldAlert className="mt-0.5 size-4 text-[color:var(--muted-strong)]" aria-hidden="true" />
            <div>
              <div className="font-medium text-[color:var(--text)]">{issue.code}</div>
              <div className="text-[color:var(--muted-strong)]">{issue.message}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
