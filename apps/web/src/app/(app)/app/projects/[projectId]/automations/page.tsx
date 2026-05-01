import { ProjectAutomationsLanding } from "@/components/shell/project-automations-landing";

export default async function ProjectAutomationsPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectAutomationsLanding projectId={projectId} />;
}
