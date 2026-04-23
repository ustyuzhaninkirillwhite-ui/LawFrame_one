import { PageShell } from "@/components/page-shell";
import { Stage11PoliciesPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityPoliciesPage() {
  return (
    <PageShell
      eyebrow="security policies"
      title="Workspace guardrails stop being tribal knowledge and become explicit configuration."
      description="MFA, SSO, AI sensitivity and delivery approval rules are surfaced as workspace policy instead of being buried in backend defaults."
      badge="stage 11.1 / 11.2"
    >
      <Stage11PoliciesPanel />
    </PageShell>
  );
}
