import { PageShell } from "@/components/page-shell";
import { RecommendationInbox } from "@/components/recommendation-inbox";

export default function WorkspaceRecommendationsPage() {
  return (
    <PageShell
      eyebrow="workspace recommendations"
      title="Team-level recommendations stay visible only to recommendation managers."
      description="Workspace view exposes shared patterns, but accepting them still creates a draft first and keeps every external action behind approval."
      badge="team scope"
    >
      <RecommendationInbox scope="team" adminMode />
    </PageShell>
  );
}
