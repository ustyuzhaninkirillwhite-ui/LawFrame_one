import { PageShell } from "@/components/page-shell";
import { Stage11AccessReviewsPanel } from "@/components/stage11-security-panels";

export default function AdminAccessReviewsPage() {
  return (
    <PageShell
      eyebrow="access reviews"
      title="Privileged access gets reviewed on a campaign cadence."
      description="Access review campaigns are part of the same control plane, so privilege hygiene no longer sits in a disconnected admin corner."
      badge="stage 11.10"
    >
      <Stage11AccessReviewsPanel />
    </PageShell>
  );
}
