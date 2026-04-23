import { ModerationQueuePanel } from "@/components/admin-stage3-panels";
import { PageShell } from "@/components/page-shell";

export default function ModerationQueuePage() {
  return (
    <PageShell
      eyebrow="moderation queue"
      title="Public library publication requests remain explicit review objects."
      description="Moderation review is a dedicated route, not an overloaded workspace template screen."
      badge="review"
    >
      <ModerationQueuePanel />
    </PageShell>
  );
}
