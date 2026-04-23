import { ModuleDetailPanel } from "@/components/module-detail-panel";
import { PageShell } from "@/components/page-shell";

export default function ModuleDetailPage() {
  return (
    <PageShell
      eyebrow="module detail"
      title="Each module publishes canonical IO and risk metadata before runtime orchestration exists."
      description="This screen is wired to the stage 3 registry, including versions, requirements and runtime mapping placeholders."
      badge="db backed"
    >
      <ModuleDetailPanel />
    </PageShell>
  );
}
