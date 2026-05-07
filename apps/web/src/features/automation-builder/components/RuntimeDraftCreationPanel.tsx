import type { AutomationRuntimeDraftResponse } from "../domain/automationBuilderTypes";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RuntimeEvidencePanel } from "./RuntimeEvidencePanel";

export function RuntimeDraftCreationPanel({
  disabled,
  canCreate,
  runtimeDraft,
  onCreate,
}: {
  readonly disabled: boolean;
  readonly canCreate: boolean;
  readonly runtimeDraft: AutomationRuntimeDraftResponse | null;
  readonly onCreate: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime draft</CardTitle>
        <CardDescription>
          Отдельное backend-controlled действие. Оно не публикует flow и не запускает production run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          disabled={disabled || !canCreate}
          onClick={() => void onCreate()}
        >
          <PlayCircle className="mr-2 size-4" aria-hidden="true" />
          Создать runtime draft
        </Button>
        <RuntimeEvidencePanel runtimeDraft={runtimeDraft} />
      </CardContent>
    </Card>
  );
}
