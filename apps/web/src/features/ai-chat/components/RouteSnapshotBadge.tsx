import type { ChatMessageDto } from "@lexframe/contracts";

export function RouteSnapshotBadge({ message }: { readonly message: ChatMessageDto }) {
  const snapshot = message.parts.find((part) => part.type === "route_snapshot");

  if (!snapshot) {
    return null;
  }

  return (
    <span className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
      route snapshot
    </span>
  );
}
