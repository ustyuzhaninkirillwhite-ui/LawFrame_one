import { NotificationsInbox } from "@/components/notifications-inbox";
import { PageShell } from "@/components/page-shell";

export default function NotificationsPage() {
  return (
    <PageShell
      eyebrow="notifications"
      title="Inbox for user-scoped operational events."
      description="Read, clear and follow notification actions without leaving the protected workspace shell."
      badge="stage 10"
    >
      <NotificationsInbox />
    </PageShell>
  );
}
