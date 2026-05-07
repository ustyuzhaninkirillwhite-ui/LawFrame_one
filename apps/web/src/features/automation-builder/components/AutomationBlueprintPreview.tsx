import type { AutomationBlueprint } from "../domain/automationBuilderTypes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { blueprintStepCount } from "../domain/automationBuilderMappers";
import { AutomationBlueprintGraphPreview } from "./AutomationBlueprintGraphPreview";
import { AutomationBlueprintStepList } from "./AutomationBlueprintStepList";
import { BuilderRouteSnapshotBadge } from "./BuilderRouteSnapshotBadge";

export function AutomationBlueprintPreview({
  blueprint,
  canViewDiagnostics,
}: {
  readonly blueprint: AutomationBlueprint | null;
  readonly canViewDiagnostics: boolean;
}) {
  if (!blueprint) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">Blueprint v{blueprint.version}</Badge>
          <Badge variant="muted">{blueprint.status}</Badge>
          <BuilderRouteSnapshotBadge
            snapshot={blueprint.routeSnapshot}
            canViewDiagnostics={canViewDiagnostics}
          />
        </div>
        <CardTitle>{blueprint.title}</CardTitle>
        <CardDescription>{blueprint.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Steps" value={String(blueprintStepCount(blueprint))} />
          <Metric label="Inputs" value={String(blueprint.workflowInputs.length)} />
          <Metric label="Approvals" value={String(blueprint.approvalGates.length)} />
        </div>
        <AutomationBlueprintGraphPreview blueprint={blueprint} />
        <AutomationBlueprintStepList steps={blueprint.steps} />
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] p-3">
      <div className="text-xs text-[color:var(--muted-strong)]">{label}</div>
      <div className="text-lg font-semibold text-[color:var(--text)]">{value}</div>
    </div>
  );
}
