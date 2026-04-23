import { Stage7DocumentAdminPanel } from "@/components/stage7-document-admin-panel";
import { PageShell } from "@/components/page-shell";

export default function DocumentTemplatesPage() {
  return (
    <PageShell
      eyebrow="settings / templates"
      title="Template library binds DOCX sources to typed placeholders and lifecycle."
      description="Stage 7 keeps template metadata, placeholder mappings and publish status above the existing document binary domain."
      badge="stage 7"
    >
      <Stage7DocumentAdminPanel mode="templates" />
    </PageShell>
  );
}
