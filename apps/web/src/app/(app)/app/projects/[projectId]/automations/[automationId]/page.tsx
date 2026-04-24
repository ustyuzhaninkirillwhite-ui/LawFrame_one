import Link from "next/link";
import { AutomationDetailPanel } from "@/components/automation-detail-panel";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default async function ProjectAutomationDetailPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly automationId: string;
  }>;
}) {
  const { projectId, automationId } = await params;

  return (
    <PageShell
      eyebrow="project automation"
      title="Детали автоматизации в контуре проекта"
      description="Экран оставляет LexFrame источником истины: проектные breadcrumbs, workflow preview, runtime/sync state, подключения, действия и история запусков читаются из backend contracts."
      badge="runtime"
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="ghost">
          <Link href={`/app/projects/${projectId}`}>К проекту</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/app/projects/${projectId}/chats/chat_project_claim_001`}>
            Чат проекта
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/app/projects/${projectId}/automations/${automationId}/builder`}>
            LexFrame Builder
          </Link>
        </Button>
      </div>
      <AutomationDetailPanel projectId={projectId} />
    </PageShell>
  );
}
