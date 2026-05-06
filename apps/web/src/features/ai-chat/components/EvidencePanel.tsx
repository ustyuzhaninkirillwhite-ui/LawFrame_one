import type { ChatMessageDto } from "@lexframe/contracts";

export function EvidencePanel({ message }: { readonly message: ChatMessageDto }) {
  const evidence = message.parts.filter((part) => part.type === "evidence");

  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 rounded border border-slate-200 p-2 text-xs text-slate-600">
      Evidence items: {evidence.length}
    </div>
  );
}
