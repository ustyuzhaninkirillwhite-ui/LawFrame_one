import { PageShell } from "@/components/page-shell";
import { Stage11AiPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityAiPage() {
  return (
    <PageShell
      eyebrow="ai security"
      title="AI routing becomes policy, not guesswork."
      description="Provider allowlists, ZDR requirements and sensitive-data posture are exposed in the same admin plane as the rest of the security controls."
      badge="stage 11.5"
    >
      <Stage11AiPanel />
    </PageShell>
  );
}
