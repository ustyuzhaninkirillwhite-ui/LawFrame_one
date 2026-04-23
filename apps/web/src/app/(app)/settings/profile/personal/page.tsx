import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function PersonalProfilePage() {
  return (
    <PageShell
      eyebrow="settings / profile"
      title="Personal profile overrides stay explicit, versioned and mergeable."
      description="Stage 7 adds personal legal-work profiles above the existing identity layer, with immutable publish and effective snapshot preview."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="personal" />
    </PageShell>
  );
}
