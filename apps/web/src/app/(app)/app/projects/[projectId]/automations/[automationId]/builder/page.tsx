import { WorkflowBuilderV1 } from "@/components/builder/workflow-builder-v1";

export default async function ProjectAutomationBuilderPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly automationId: string;
  }>;
}) {
  const { projectId, automationId } = await params;

  return <WorkflowBuilderV1 projectId={projectId} automationId={automationId} />;
}
