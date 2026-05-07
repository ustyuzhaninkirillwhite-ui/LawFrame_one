import type { AutomationBlueprint } from "../domain/automationBuilderTypes";
import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPolicyValue } from "../domain/automationBuilderMappers";

export function BlueprintContextPanel({
  blueprint,
}: {
  readonly blueprint: AutomationBlueprint;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="muted">
            policy: {formatPolicyValue(blueprint.sourceContext.policyDecision)}
          </Badge>
          <Badge variant="muted">
            budget: {blueprint.sourceContext.contextBudgetTokens ?? 0} tokens
          </Badge>
        </div>
        <div className="space-y-2">
          {blueprint.sourceContext.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--line)] p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Database className="size-4 text-[color:var(--muted-strong)]" aria-hidden="true" />
                <span>{item.type ?? item.sourceType ?? "context_item"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.blocked ? "danger" : "muted"}>
                  {item.selectedMode ?? "reference_only"}
                </Badge>
                <span className="text-xs text-[color:var(--muted-strong)]">
                  {formatPolicyValue(String(item.classification ?? ""))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
