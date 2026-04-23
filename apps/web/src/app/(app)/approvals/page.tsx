import { ApprovalInboxPanel } from "@/components/approval-inbox-panel";
import { PageShell } from "@/components/page-shell";

export default function ApprovalsPage() {
  return (
    <PageShell
      eyebrow="approvals"
      title="Approval routes and tasks gate risky document actions."
      description="Finalization and external delivery no longer pass around approval state implicitly; they create explicit inbox tasks."
      badge="stage 8"
    >
      <ApprovalInboxPanel />
    </PageShell>
  );
}
