import { LibraryCatalog } from "@/components/library-catalog";
import { PageShell } from "@/components/page-shell";

export default function LibraryPage() {
  return (
    <PageShell
      eyebrow="library"
      title="Product templates remain canonical long before runtime is production-ready."
      description="Здесь каталог шаблонов уже существует как часть product model: ownership, readiness, module requirements и permission vocabulary видны до реального Activepieces execution."
      badge="contract driven"
    >
      <LibraryCatalog />
    </PageShell>
  );
}

