import { Stage7GenerationPanel } from "@/components/stage7-generation-panel";
import { PageShell } from "@/components/page-shell";

export default async function DocumentGenerationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string }>;
}) {
  const { jobId } = await params;

  return (
    <PageShell
      eyebrow="documents / generation"
      title="Preview, validation and approval converge in one generation job."
      description="Generation detail keeps preview state, validation blockers and approval gate status in a single Stage 7 record."
      badge="stage 7"
    >
      <Stage7GenerationPanel jobId={jobId} />
    </PageShell>
  );
}
