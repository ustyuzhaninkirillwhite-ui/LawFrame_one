import { PageShell } from "@/components/page-shell";
import { Stage11SessionsPanel } from "@/components/stage11-security-panels";

export default function AdminSecuritySessionsPage() {
  return (
    <PageShell
      eyebrow="security sessions"
      title="Every privileged session stays visible, attributable and revocable."
      description="Session inventory is now a first-class admin surface: current device, recent activity, revocation flow and reauth boundary all live in one place."
      badge="stage 11.1"
    >
      <Stage11SessionsPanel />
    </PageShell>
  );
}
