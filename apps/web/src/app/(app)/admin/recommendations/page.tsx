import { PageShell } from "@/components/page-shell";
import { RecommendationAdminAnalytics } from "@/components/recommendation-admin-analytics";

export default function AdminRecommendationsPage() {
  return (
    <PageShell
      eyebrow="admin recommendations"
      title="Process mining and recommendation health stay in admin-only surfaces."
      description="Analytics view exposes mined patterns, process cases, module mapping and quality signals without turning recommendations into runnable automation."
      badge="admin only"
    >
      <RecommendationAdminAnalytics />
    </PageShell>
  );
}
