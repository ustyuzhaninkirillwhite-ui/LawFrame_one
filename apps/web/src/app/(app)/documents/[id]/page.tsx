import Link from "next/link";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default async function DocumentDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell
      eyebrow="document detail"
      title="Each document stays canonical even when storage objects and previews multiply."
      description="The document detail page keeps versions, processing jobs, relations, and signed URL flows attached to one canonical entity."
      badge="immutable versions"
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="ghost">
          <Link href={`/chat?source=document_chat&documentId=${id}`}>
            Открыть ИИ-чат по документу
          </Link>
        </Button>
      </div>
      <DocumentDetailPanel documentId={id} />
    </PageShell>
  );
}
