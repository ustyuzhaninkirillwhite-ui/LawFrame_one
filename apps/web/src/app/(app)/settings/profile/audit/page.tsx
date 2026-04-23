import { Stage7ProfilePanel } from "@/components/stage7-profile-panel";
import { PageShell } from "@/components/page-shell";

export default function ProfileAuditPage() {
  return (
    <PageShell
      eyebrow="settings / audit"
      title="Profile and approval changes stay visible in one audit stream."
      description="Stage 7 writes profile publish, snapshot, template and approval actions into the shared backend audit log."
      badge="stage 7"
    >
      <Stage7ProfilePanel mode="audit" />
    </PageShell>
  );
}
