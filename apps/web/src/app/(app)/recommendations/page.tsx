import { PageShell } from "@/components/page-shell";
import { RecommendationInbox } from "@/components/recommendation-inbox";

export default function RecommendationsPage() {
  return (
    <PageShell
      eyebrow="recommendations"
      title="Recommendations stay advisory-only until a human converts them into a workflow draft."
      description="The inbox now shows repeat count, explainability, workflow skeleton and explicit approval-safe delivery rules. Accept only creates a draft and never syncs runtime by itself."
      badge="advisory"
    >
      <RecommendationInbox />
    </PageShell>
  );
}
