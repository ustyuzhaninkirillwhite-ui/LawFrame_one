import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function EffectiveProfilePage() {
  return (
    <PageShell
      eyebrow="settings / effective"
      title="Effective profile is always backend-derived."
      description="Preview and run execution use the same effective snapshot logic rather than duplicating merge policy in the client."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="effective" />
    </PageShell>
  );
}
