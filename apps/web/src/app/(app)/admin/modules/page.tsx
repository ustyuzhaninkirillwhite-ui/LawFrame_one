import { AdminModulesPanel } from "@/components/admin-stage3-panels";
import { PageShell } from "@/components/page-shell";

export default function AdminModulesPage() {
  return (
    <PageShell
      eyebrow="admin modules"
      title="Legal module administration stays on the backend and remains version-aware."
      description="Module management visibility is separated from workspace draft editing and public moderation."
      badge="admin"
    >
      <AdminModulesPanel />
    </PageShell>
  );
}
