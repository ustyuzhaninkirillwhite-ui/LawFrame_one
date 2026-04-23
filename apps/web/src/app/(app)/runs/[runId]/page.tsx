import { PageShell } from "@/components/page-shell";
import { RunDetailPanel } from "@/components/run-detail-panel";

export default async function RunDetailPage({
  params,
}: {
  readonly params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <PageShell
      eyebrow="runs"
      title="Execution core snapshot"
      description="Run-centric view of approvals, artifacts and delivery for the email-first MVP."
      badge="stage 8"
    >
      <RunDetailPanel runId={runId} />
    </PageShell>
  );
}
