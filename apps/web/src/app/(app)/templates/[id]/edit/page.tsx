import { PageShell } from "@/components/page-shell";
import { TemplateEditorPanel } from "@/components/template-workspace-panels";

export default function TemplateEditPage() {
  return (
    <PageShell
      eyebrow="template edit"
      title="Template root metadata and version payloads evolve independently."
      description="Metadata updates stay on the template root while new draft versions snapshot workflow and requirements."
      badge="draft editor"
    >
      <TemplateEditorPanel />
    </PageShell>
  );
}
