import type { AutomationBlueprint } from "../domain/automationBuilderTypes";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BlueprintRiskPanel({
  blueprint,
}: {
  readonly blueprint: AutomationBlueprint;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Risk</CardTitle>
        <Badge
          variant={
            blueprint.riskReport.riskLevel === "critical" ||
            blueprint.riskReport.riskLevel === "high"
              ? "danger"
              : "muted"
          }
        >
          {blueprint.riskReport.riskLevel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-[color:var(--muted-strong)]">
        {[...blueprint.riskReport.blocks, ...blueprint.riskReport.warnings].length ===
        0 ? (
          <div>Нет блокирующих рисков в текущем Blueprint.</div>
        ) : (
          [...blueprint.riskReport.blocks, ...blueprint.riskReport.warnings].map(
            (item) => (
              <div key={item} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ),
          )
        )}
      </CardContent>
    </Card>
  );
}
