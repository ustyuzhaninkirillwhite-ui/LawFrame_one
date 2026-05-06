import type { ChatStreamSnapshot } from "@lexframe/contracts";

export function streamSnapshotToText(snapshot: ChatStreamSnapshot) {
  return snapshot.events
    .filter((event) => event.type === "text_delta")
    .map((event) =>
      typeof event.payload.delta === "string" ? event.payload.delta : "",
    )
    .join("");
}
