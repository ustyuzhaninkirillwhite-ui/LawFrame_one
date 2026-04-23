import { PageShell } from "@/components/page-shell";
import { Stage11SecretsPanel } from "@/components/stage11-security-panels";

export default function AdminSecuritySecretsPage() {
  return (
    <PageShell
      eyebrow="secrets"
      title="Secret state is inspectable without leaking secret material."
      description="Inventory, rotation cadence and compromise handling remain backend-only but visible enough for admins to operate securely."
      badge="stage 11.3"
    >
      <Stage11SecretsPanel />
    </PageShell>
  );
}
