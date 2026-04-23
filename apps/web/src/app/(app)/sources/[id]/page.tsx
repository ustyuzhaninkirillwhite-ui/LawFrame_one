import { LegalSourceDetailView } from "@/components/legal/legal-source-detail-view";
import { PageShell } from "@/components/page-shell";

export default async function SourceDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell
      eyebrow="source detail"
      title="Every legal source now carries its own import, extraction and chunking audit trail."
      description="The detail page exposes how one workspace source moved from document storage into the legal semantic layer used by search, workflow runtime and RAG."
      badge="stage 6"
    >
      <LegalSourceDetailView sourceId={id} />
    </PageShell>
  );
}
