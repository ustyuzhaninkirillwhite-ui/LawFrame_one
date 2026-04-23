import { ModerationDetailPanel } from "@/components/admin-stage3-panels";
import { PageShell } from "@/components/page-shell";

export default function ModerationDetailPage() {
  return (
    <PageShell
      eyebrow="moderation detail"
      title="Approve, reject or request changes without mutating the workspace draft."
      description="Approval creates the public library projection while preserving the workspace-owned template branch."
      badge="decision"
    >
      <ModerationDetailPanel />
    </PageShell>
  );
}
