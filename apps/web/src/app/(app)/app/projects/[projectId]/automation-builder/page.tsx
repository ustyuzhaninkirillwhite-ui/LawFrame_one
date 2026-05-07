import { AutomationBuilderShell } from "@/features/automation-builder";

export default async function ProjectAutomationBuilderPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}) {
  const { projectId } = await params;

  return <AutomationBuilderShell projectId={projectId} />;
}
