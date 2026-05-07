import { AutomationBuilderShell } from "@/features/automation-builder";

export default async function ProjectAutomationBlueprintPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly blueprintId: string;
  }>;
}) {
  const { projectId, blueprintId } = await params;

  return (
    <AutomationBuilderShell
      projectId={projectId}
      initialBlueprintId={blueprintId}
    />
  );
}
