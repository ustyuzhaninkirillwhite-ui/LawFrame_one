import { Stage7DocumentAdminPanel } from "@/components/stage7-document-admin-panel";
import { PageShell } from "@/components/page-shell";

export default function ClausesPage() {
  return (
    <PageShell
      eyebrow="settings / clauses"
      title="Clause library and phrase rules control drafting language."
      description="Reusable text blocks stay in schema-driven rich text while forbidden and preferred phrases remain separately auditable."
      badge="stage 7"
    >
      <Stage7DocumentAdminPanel mode="clauses" />
    </PageShell>
  );
}
