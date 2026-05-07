import { WorkflowCanvasPage } from "@/features/canvas/pages/workflow-canvas-page";

export default async function ProjectAutomationCanvasPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly automationId: string;
  }>;
}) {
  const { projectId, automationId } = await params;

  return <WorkflowCanvasPage projectId={projectId} automationId={automationId} />;
}
