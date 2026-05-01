import { ActivepiecesCanvasRoute } from "@/features/automation-canvas";

export default async function ProjectAutomationActivepiecesPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly automationId: string;
  }>;
}) {
  const { projectId, automationId } = await params;

  return (
    <ActivepiecesCanvasRoute projectId={projectId} automationId={automationId} />
  );
}
