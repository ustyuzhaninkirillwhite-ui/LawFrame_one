import { redirect } from "next/navigation";

export default async function ProjectAutomationCanvasPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly automationId: string;
  }>;
}) {
  const { projectId, automationId } = await params;

  redirect(`/app/projects/${projectId}/automations/${automationId}/automation`);
}
