import { PageShell } from "@/components/page-shell";
import { Stage11ActivepiecesPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityActivepiecesPage() {
  return (
    <PageShell
      eyebrow="activepieces"
      title="Builder access is short-lived, scoped and incident-aware."
      description="The control plane shows token TTL, incident locks and runtime connection posture without ever exposing backend credentials."
      badge="stage 11.7"
    >
      <Stage11ActivepiecesPanel />
    </PageShell>
  );
}
