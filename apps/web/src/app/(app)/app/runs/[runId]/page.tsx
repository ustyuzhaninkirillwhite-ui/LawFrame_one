import { PageShell } from "@/components/page-shell";
import { RunDetailPanel } from "@/components/run-detail-panel";

export default async function AppRunDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly runId: string }>;
}) {
  const { runId } = await params;

  return (
    <PageShell
      eyebrow="run center"
      title="Run Center"
      description="Полная timeline UX для запуска: шаги, approvals, delivery, artifacts, notifications и fallback на snapshot polling."
      badge="stage 15"
    >
      <RunDetailPanel runId={runId} />
    </PageShell>
  );
}
