import { LegalSourcesWorkspace } from "@/components/legal/legal-sources-workspace";
import { PageShell } from "@/components/page-shell";

export default function SourcesPage() {
  return (
    <PageShell
      eyebrow="sources"
      title="Source registry, import jobs and semantic indexing now form the legal research backbone."
      description="Stage 6 keeps legal sources separate from file storage, attaches lifecycle and access state to each source, and prepares them for search and citation-validated RAG."
      badge="stage 6"
    >
      <LegalSourcesWorkspace />
    </PageShell>
  );
}
