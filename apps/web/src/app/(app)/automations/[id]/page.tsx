import Link from "next/link";
import { AutomationDetailPanel } from "@/components/automation-detail-panel";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default async function AutomationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell
      eyebrow="automation detail"
      title="Stage 4 binds install, sync, builder, and execution into one runtime contour."
      description="The detail card keeps the pinned automation, runtime binding, connections, pieces, warnings, and run history in one place. Activepieces stays downstream runtime, not the source of truth."
      badge="runtime"
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="ghost">
          <Link href={`/chat?source=automation_chat&automationId=${id}`}>
            Открыть ИИ-чат для правки
          </Link>
        </Button>
      </div>
      <AutomationDetailPanel />
    </PageShell>
  );
}
