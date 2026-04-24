import { redirect } from "next/navigation";

export default async function RunDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly runId: string }>;
}) {
  const { runId } = await params;

  redirect(`/app/runs/${runId}`);
}
