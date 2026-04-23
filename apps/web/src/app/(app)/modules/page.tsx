import { ModulesCatalog } from "@/components/modules-catalog";
import { PageShell } from "@/components/page-shell";

export default function ModulesPage() {
  return (
    <PageShell
      eyebrow="modules"
      title="Legal modules are versioned product contracts, not builder-local actions."
      description="Stage 3 exposes the module registry with IO schemas, requirements and runtime mapping placeholders."
      badge="registry"
    >
      <ModulesCatalog />
    </PageShell>
  );
}
