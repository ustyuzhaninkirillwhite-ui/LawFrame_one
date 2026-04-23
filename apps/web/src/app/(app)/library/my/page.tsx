import { PageShell } from "@/components/page-shell";
import { MyTemplatesPanel } from "@/components/template-workspace-panels";

export default function MyTemplatesPage() {
  return (
    <PageShell
      eyebrow="my templates"
      title="Workspace drafts stay separate from product and public templates."
      description="This view renders workspace/private scope templates and their publication state."
      badge="workspace scope"
    >
      <MyTemplatesPanel />
    </PageShell>
  );
}
