import type { AutomationPlannerEventType } from "@lexframe/contracts";
import { CheckCircle2, CircleDashed } from "lucide-react";

const defaultEvents: readonly AutomationPlannerEventType[] = [
  "intent_created",
  "context_collecting",
  "context_collected",
  "planning_started",
  "schema_validation_started",
  "blueprint_validation_started",
  "blueprint_created",
  "user_approval_required",
];

export function BlueprintProgressTimeline({
  events,
}: {
  readonly events: readonly AutomationPlannerEventType[];
}) {
  const visibleEvents = events.length > 0 ? events : defaultEvents;

  return (
    <div className="space-y-2">
      {visibleEvents.map((event, index) => {
        const completed = events.includes(event);
        return (
          <div
            key={`${event}-${index}`}
            className="flex items-center gap-2 text-sm text-[color:var(--muted-strong)]"
          >
            {completed ? (
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-4" aria-hidden="true" />
            )}
            <span>{event}</span>
          </div>
        );
      })}
    </div>
  );
}
