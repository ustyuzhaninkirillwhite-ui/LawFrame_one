import { PageShell } from "@/components/page-shell";
import { SecurityConsole } from "@/components/security-console";

export default function AdminSecurityPage() {
  return (
    <PageShell
      eyebrow="admin security"
      title="Release gates stay visible to the team long before the first beta."
      description="Здесь сходятся security assumptions LexFrame: backend-only secrets, approval-first external delivery, traceability, reauth для risk actions и browser access только к RLS-safe данным."
      badge="owner / admin / security_admin"
    >
      <SecurityConsole />
    </PageShell>
  );
}
