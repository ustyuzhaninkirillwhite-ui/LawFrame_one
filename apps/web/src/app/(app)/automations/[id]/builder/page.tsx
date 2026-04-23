import { BuilderReadiness } from "@/components/builder-readiness";
import { PageShell } from "@/components/page-shell";

export default function AutomationBuilderPage() {
  return (
    <PageShell
      eyebrow="builder"
      title="Builder session короткоживущая, backend-issued и привязана к runtime binding."
      description="Stage 4 открывает реальный embedded builder после sync: backend создаёт project/user binding, выдаёт short-lived token и управляет allowed pieces через runtime boundary."
      badge="embedded"
    >
      <BuilderReadiness />
    </PageShell>
  );
}
