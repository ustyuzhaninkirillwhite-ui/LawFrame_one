import { ProjectHome } from "@/components/shell/project-home";

export default async function ProjectPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectHome projectId={projectId} />;
}
