import { PageShell } from "@/components/page-shell";
import { AutomationUpdatesPanel } from "@/components/template-workspace-panels";

export default function AutomationUpdatesPage() {
  return (
    <PageShell
      eyebrow="source updates"
      title="Installed automations update only when the workspace explicitly applies a new source version."
      description="This page compares the pinned source version with the latest template version and applies the diff on demand."
      badge="pinned"
    >
      <AutomationUpdatesPanel />
    </PageShell>
  );
}
