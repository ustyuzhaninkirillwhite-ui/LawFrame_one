import { LegalResearchWorkspace } from "@/components/legal/legal-research-workspace";
import { PageShell } from "@/components/page-shell";

export default async function ResearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly sourceId?: string }>;
}) {
  const params = await searchParams;

  return (
    <PageShell
      eyebrow="research"
      title="Hybrid search and citation-validated analysis now live inside one research surface."
      description="The research route keeps legal search, source basket selection and RAG on the backend, then renders only product-safe JSON results with stable citations."
      badge="stage 6"
    >
      <LegalResearchWorkspace initialSourceId={params.sourceId ?? null} />
    </PageShell>
  );
}
