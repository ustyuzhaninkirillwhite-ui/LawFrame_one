import { PageShell } from "@/components/page-shell";
import { Stage11AlertsPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityAlertsPage() {
  return (
    <PageShell
      eyebrow="alerts"
      title="Alerts stay actionable instead of becoming background noise."
      description="Acknowledgement and resolution flow through explicit admin actions and land in the same audit trail that drives incident response."
      badge="stage 11.9"
    >
      <Stage11AlertsPanel />
    </PageShell>
  );
}
