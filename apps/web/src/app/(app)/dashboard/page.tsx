import { DashboardOverview } from "@/components/dashboard-overview";
import { PageShell } from "@/components/page-shell";

export default function DashboardPage() {
  return (
    <PageShell
      eyebrow="stage 10"
      title="Realtime control room for executions, approvals and inbox load."
      description="Snapshot endpoint stays canonical, realtime only accelerates delta delivery, and recovery still flows through server-owned sequence logs."
      badge="operational transparency"
    >
      <DashboardOverview />
    </PageShell>
  );
}
