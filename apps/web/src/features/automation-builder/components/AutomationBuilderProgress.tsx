import type { AutomationPlannerEventType } from "@lexframe/contracts";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationBuilderStage } from "../domain/automationBuilderTypes";
import { BlueprintProgressTimeline } from "./BlueprintProgressTimeline";

const stageLabels: Record<AutomationBuilderStage, string> = {
  idle: "ожидает задачи",
  intent: "Intent создан",
  planning: "планирование",
  clarification: "нужны уточнения",
  preview: "Blueprint готов",
  approved: "Blueprint согласован",
  canvas_draft: "Canvas draft создан",
  runtime_draft: "runtime draft создан",
  blocked: "заблокировано",
};

export function AutomationBuilderProgress({
  stage,
  pending,
  events,
}: {
  readonly stage: AutomationBuilderStage;
  readonly pending: boolean;
  readonly events: readonly AutomationPlannerEventType[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Progress</CardTitle>
        <Badge variant={stage === "blocked" ? "danger" : "muted"}>
          {stageLabels[stage]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted-strong)]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Backend выполняет policy-gated действие
          </div>
        ) : null}
        <BlueprintProgressTimeline events={events} />
      </CardContent>
    </Card>
  );
}
