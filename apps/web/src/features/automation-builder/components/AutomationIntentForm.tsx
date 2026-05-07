import type { AutomationDataClassification } from "@lexframe/contracts";
import { ShieldCheck } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AutomationGoalComposer } from "./AutomationGoalComposer";

const classifications: readonly AutomationDataClassification[] = [
  "workspace_internal",
  "confidential",
  "client_material",
  "personal_data",
  "legal_secret",
  "public",
];

export function AutomationIntentForm({
  disabled,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly onSubmit: (input: {
    readonly goal: string;
    readonly classification: AutomationDataClassification;
  }) => Promise<void>;
}) {
  const [classification, setClassification] =
    React.useState<AutomationDataClassification>("workspace_internal");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="muted">Stage 20</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--muted-strong)]">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Backend-owned route automation_planner_high
          </span>
        </div>
        <CardTitle>AI Automation Builder</CardTitle>
        <CardDescription>
          Опишите юридический процесс. LexFrame создаст Intent, соберет разрешенный контекст и вернет валидируемый Blueprint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-[color:var(--text)]">
          Classification
          <Select
            value={classification}
            disabled={disabled}
            onChange={(event) =>
              setClassification(event.target.value as AutomationDataClassification)
            }
          >
            {classifications.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
        <AutomationGoalComposer
          disabled={disabled}
          onSubmit={(goal) => onSubmit({ goal, classification })}
        />
      </CardContent>
    </Card>
  );
}
