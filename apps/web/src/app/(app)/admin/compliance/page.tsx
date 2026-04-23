import { PageShell } from "@/components/page-shell";
import { Stage11CompliancePanel } from "@/components/stage11-security-panels";

export default function AdminCompliancePage() {
  return (
    <PageShell
      eyebrow="compliance"
      title="Retention and DSR posture stay next to security operations, not outside them."
      description="Processing activities, retention policies and subject-rights workload are presented as operational controls with the same admin rigor as incidents."
      badge="stage 11.8"
    >
      <Stage11CompliancePanel />
    </PageShell>
  );
}
