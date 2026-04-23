import { PageShell } from "@/components/page-shell";
import { TemplatePublicationStatusPanel } from "@/components/template-workspace-panels";

export default function TemplatePublicationStatusPage() {
  return (
    <PageShell
      eyebrow="publication status"
      title="Workspace draft and public projection keep separate lifecycles."
      description="The route shows publication state and the latest visible moderation record for the selected template."
      badge="status"
    >
      <TemplatePublicationStatusPanel />
    </PageShell>
  );
}
