"use client";

import type { ActivepiecesSessionWarning } from "@lexframe/contracts";
import { Badge } from "@/components/ui/badge";

export function LocalKeysWarningBanner({
  warnings,
}: {
  readonly warnings?: readonly ActivepiecesSessionWarning[];
}) {
  const warning = warnings?.find(
    (item) =>
      item.code === "LOCAL_OWNER_KEYS_MISSING" ||
      item.code === "LOCAL_KEYS_INVALID",
  );

  if (!warning) {
    return null;
  }

  return (
    <div className="rounded-[8px] border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-4 text-sm leading-6 text-[color:var(--foreground)]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="danger">{warning.code}</Badge>
        <span className="font-medium">{warning.title}</span>
      </div>
      <p className="text-[color:var(--muted-strong)]">{warning.message}</p>
    </div>
  );
}
