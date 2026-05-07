import type { AiRouteSnapshotSafe } from "@lexframe/contracts";
import { Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function BuilderRouteSnapshotBadge({
  snapshot,
  canViewDiagnostics,
}: {
  readonly snapshot?: AiRouteSnapshotSafe;
  readonly canViewDiagnostics: boolean;
}) {
  if (!snapshot) {
    return <Badge variant="muted">route not recorded</Badge>;
  }

  return (
    <Badge variant="muted" className="inline-flex items-center gap-1">
      <Route className="size-3.5" aria-hidden="true" />
      {snapshot.route}
      {canViewDiagnostics ? ` / ${snapshot.provider}:${snapshot.model}` : ""}
    </Badge>
  );
}
