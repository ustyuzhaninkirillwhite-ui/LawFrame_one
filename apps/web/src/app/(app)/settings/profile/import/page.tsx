import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function ProfileImportPage() {
  return (
    <PageShell
      eyebrow="settings / import"
      title="Imported documents create draft profile suggestions only."
      description="Import pipeline extracts hints and prepares a draft job without auto-publishing or replacing the active profile."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="import" />
    </PageShell>
  );
}
