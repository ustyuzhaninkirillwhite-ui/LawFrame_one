import { redirect } from "next/navigation";

export default async function AutomationBuilderPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  redirect(`/app/projects/project_claim_001/automations/${id}/advanced-builder`);
}
