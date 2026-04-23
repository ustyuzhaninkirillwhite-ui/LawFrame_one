import { DocumentList } from "@/components/document-list";
import { PageShell } from "@/components/page-shell";

export default function DocumentsPage() {
  return (
    <PageShell
      eyebrow="documents"
      title="Document domain owns versions, storage rules and workflow artifacts."
      description="Stage 2 даёт реальную библиотеку документов: immutable versions, signed URL boundary, run artifacts, processing queue и шаблоны внутри одного канонического слоя."
      badge="stage 2"
    >
      <DocumentList />
    </PageShell>
  );
}
