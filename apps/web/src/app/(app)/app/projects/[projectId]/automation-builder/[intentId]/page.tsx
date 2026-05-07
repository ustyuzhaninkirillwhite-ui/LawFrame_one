import { AutomationBuilderShell } from "@/features/automation-builder";

export default async function ProjectAutomationBuilderIntentPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly intentId: string;
  }>;
}) {
  const { projectId, intentId } = await params;

  return <AutomationBuilderShell projectId={projectId} initialIntentId={intentId} />;
}
