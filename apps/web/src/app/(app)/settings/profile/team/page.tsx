import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function TeamProfilePage() {
  return (
    <PageShell
      eyebrow="settings / team profile"
      title="Workspace profile defines locked defaults for the team."
      description="Team rules remain authoritative and personal overrides cannot remove locked sections silently."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="team" />
    </PageShell>
  );
}
