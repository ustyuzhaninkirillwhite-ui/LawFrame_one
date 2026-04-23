import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function ProfileVersionsPage() {
  return (
    <PageShell
      eyebrow="settings / versions"
      title="Published profile versions remain immutable."
      description="Restoring an older profile state creates a new draft version instead of mutating published history."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="versions" />
    </PageShell>
  );
}
