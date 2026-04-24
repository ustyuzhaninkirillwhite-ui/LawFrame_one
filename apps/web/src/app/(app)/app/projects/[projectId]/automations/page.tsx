import { AutomationWorkbench } from "@/components/automations/automation-workbench";

export default async function ProjectAutomationsPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}) {
  const { projectId } = await params;

  return <AutomationWorkbench projectId={projectId} />;
}
