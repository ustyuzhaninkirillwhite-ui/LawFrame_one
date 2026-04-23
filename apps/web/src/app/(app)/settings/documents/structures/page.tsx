import { Stage7DocumentAdminPanel } from "@/components/stage7-document-admin-panel";
import { PageShell } from "@/components/page-shell";

export default function DocumentStructuresPage() {
  return (
    <PageShell
      eyebrow="settings / documents"
      title="Document types and structures define the canonical drafting skeleton."
      description="Sections, required blocks and placeholder-ready slots are stored in Stage 7 rather than inferred ad hoc during generation."
      badge="stage 7"
    >
      <Stage7DocumentAdminPanel mode="structures" />
    </PageShell>
  );
}
