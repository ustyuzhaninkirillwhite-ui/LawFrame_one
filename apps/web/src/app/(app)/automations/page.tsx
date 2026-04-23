import { InstalledAutomationList } from "@/components/installed-automation-list";
import { PageShell } from "@/components/page-shell";

export default function AutomationsPage() {
  return (
    <PageShell
      eyebrow="automations"
      title="Installed automation is a product record first, runtime projection second."
      description="Stage 3 keeps installed automations as workspace-owned records pinned to a source template version, with explicit sync and compatibility states."
      badge="stage 3"
    >
      <InstalledAutomationList />
    </PageShell>
  );
}
