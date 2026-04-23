import { PageShell } from "@/components/page-shell";
import { Stage11AuditPanel } from "@/components/stage11-security-panels";

export default function AdminSecurityAuditPage() {
  return (
    <PageShell
      eyebrow="audit"
      title="One immutable audit stream, richer context."
      description="Stage 11 keeps the canonical audit store intact and extends each event with category, session and data-class detail for investigations."
      badge="stage 11.4"
    >
      <Stage11AuditPanel />
    </PageShell>
  );
}
