import { PageShell } from "@/components/page-shell";
import { Stage11IncidentsPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityIncidentsPage() {
  return (
    <PageShell
      eyebrow="incidents"
      title="Containment decisions are visible before they become outages."
      description="Incident mode, assignee state and status transitions live in the same admin surface as sessions, secrets and delivery controls."
      badge="stage 11.9"
    >
      <Stage11IncidentsPanel />
    </PageShell>
  );
}
