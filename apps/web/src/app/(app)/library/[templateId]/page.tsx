import { PageShell } from "@/components/page-shell";
import { TemplateDetailPanel } from "@/components/template-detail-panel";

export default function LibraryTemplateDetailPage() {
  return (
    <PageShell
      eyebrow="template detail"
      title="Template detail owns install, readiness and related-library context."
      description="The page renders backend-issued availability, requirements, version history and a workspace install flow."
      badge="stage 3"
    >
      <TemplateDetailPanel />
    </PageShell>
  );
}
