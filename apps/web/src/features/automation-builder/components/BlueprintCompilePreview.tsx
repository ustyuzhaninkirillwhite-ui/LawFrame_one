import type { AutomationCompilePreviewResponse } from "../domain/automationBuilderTypes";
import { FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BlueprintCompilePreview({
  preview,
}: {
  readonly preview: AutomationCompilePreviewResponse | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Compile preview</CardTitle>
        <Badge variant={preview?.status === "preview_ready" ? "muted" : "warning"}>
          {preview?.status ?? "not_run"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-[color:var(--muted-strong)]">
          <FileCode2 className="size-4" aria-hidden="true" />
          workflow hash: {preview?.workflowHash ?? "not generated"}
        </div>
        <div>
          <div className="font-medium">Required pieces</div>
          <div className="mt-1 text-[color:var(--muted-strong)]">
            {preview?.requiredPieces.join(", ") || "none"}
          </div>
        </div>
        <div>
          <div className="font-medium">Required connections</div>
          <div className="mt-1 text-[color:var(--muted-strong)]">
            {preview?.requiredConnections.join(", ") || "none"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
