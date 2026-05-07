import type { AutomationBlueprint } from "../domain/automationBuilderTypes";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BlueprintApprovalPanel({
  blueprint,
  disabled,
  onApprove,
  onReject,
  onConvert,
}: {
  readonly blueprint: AutomationBlueprint | null;
  readonly disabled: boolean;
  readonly onApprove: () => Promise<void>;
  readonly onReject: () => Promise<void>;
  readonly onConvert: () => Promise<void>;
}) {
  if (!blueprint) {
    return null;
  }

  const canApprove = blueprint.validationSummary.canApprove;
  const canConvert = blueprint.validationSummary.canConvertToCanvasDraft;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Human confirmation</CardTitle>
        <CardDescription>
          Согласование создает только approved Blueprint; publish, production run и delivery здесь недоступны.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={disabled || !canApprove}
          onClick={() => void onApprove()}
        >
          <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
          Согласовать Blueprint
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => void onReject()}
        >
          <XCircle className="mr-2 size-4" aria-hidden="true" />
          Отклонить
        </Button>
        <Button
          type="button"
          variant="subtle"
          disabled={disabled || !canConvert}
          onClick={() => void onConvert()}
        >
          Создать Canvas draft
        </Button>
      </CardContent>
    </Card>
  );
}
