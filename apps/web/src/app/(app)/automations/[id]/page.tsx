import { redirect } from "next/navigation";

export default async function AutomationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  redirect(`/app/projects/project_claim_001/automations/${id}`);
}
