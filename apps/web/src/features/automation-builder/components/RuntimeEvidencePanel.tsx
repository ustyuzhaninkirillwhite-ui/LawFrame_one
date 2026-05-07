import type { AutomationRuntimeDraftResponse } from "../domain/automationBuilderTypes";
import { Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RuntimeEvidencePanel({
  runtimeDraft,
}: {
  readonly runtimeDraft: AutomationRuntimeDraftResponse | null;
}) {
  if (!runtimeDraft) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Runtime evidence</CardTitle>
        <Badge
          variant={
            runtimeDraft.status === "runtime_created" ? "muted" : "warning"
          }
        >
          {runtimeDraft.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-[color:var(--muted-strong)]">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4" aria-hidden="true" />
          evidence hash: {runtimeDraft.evidenceHash}
        </div>
        <div>AP flow: {runtimeDraft.activepiecesFlowId ?? "not configured"}</div>
        <div>MCP invocation: {runtimeDraft.mcpInvocationId ?? "none"}</div>
        {runtimeDraft.warnings.map((warning) => (
          <div key={warning}>warning: {warning}</div>
        ))}
      </CardContent>
    </Card>
  );
}
