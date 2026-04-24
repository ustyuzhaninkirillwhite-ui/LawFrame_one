import Link from "next/link";
import { BuilderReadiness } from "@/components/builder-readiness";
import { PageShell } from "@/components/page-shell";
import { PermissionGate } from "@/components/status/permission-gate";
import { Button } from "@/components/ui/button";

export default async function ProjectAutomationAdvancedBuilderPage({
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
      eyebrow="advanced builder"
      title="Activepieces advanced builder"
      description="Embedded session получает только backend-issued token, не хранит его в localStorage и обновляет сессию через backend refetch."
      badge="permission gated"
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="ghost">
          <Link href={`/app/projects/${projectId}/automations/${automationId}/builder`}>
            LexFrame Builder
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/app/projects/${projectId}/automations/${automationId}`}>
            Детали
          </Link>
        </Button>
      </div>
      <PermissionGate permission="activepieces.open_builder">
        <BuilderReadiness projectId={projectId} />
      </PermissionGate>
    </PageShell>
  );
}
