import { PageShell } from "@/components/page-shell";
import { TemplatePublicationPanel } from "@/components/template-workspace-panels";

export default function TemplatePublishPage() {
  return (
    <PageShell
      eyebrow="publication"
      title="Publishing and moderation are explicit product flows, not hidden side effects."
      description="This route exposes internal draft publication and public-library submission as separate actions."
      badge="moderation"
    >
      <TemplatePublicationPanel />
    </PageShell>
  );
}
