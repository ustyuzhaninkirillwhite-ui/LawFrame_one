import { AdminModuleDetailPanel } from "@/components/admin-stage3-panels";
import { PageShell } from "@/components/page-shell";

export default function AdminModuleDetailPage() {
  return (
    <PageShell
      eyebrow="admin module detail"
      title="Module versions, validation and publication remain explicit."
      description="This admin view is bound to the same registry contract used by template validation."
      badge="versioned"
    >
      <AdminModuleDetailPanel />
    </PageShell>
  );
}
