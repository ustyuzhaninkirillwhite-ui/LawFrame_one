"use client";

import Link from "next/link";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState, badgeVariantForStatus } from "@/components/stage3-shared";

export function NotificationsInbox() {
  const notifications = useNotifications({ limit: 50 });
  const markAllRead = useMarkAllNotificationsRead();

  if (notifications.isLoading || !notifications.data) {
    return (
      <QueryState
        title="Loading inbox"
        description="Personalized notifications are loaded from the stage-10 inbox endpoint with cursor metadata and unread counters."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="accent">inbox</Badge>
            <CardTitle className="mt-3">Notifications</CardTitle>
            <CardDescription>
              User-scoped inbox with actionable links into runs, approvals and documents.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{notifications.data.unreadCount} unread</Badge>
            <Button
              variant="ghost"
              onClick={() => void markAllRead.mutateAsync()}
              disabled={markAllRead.isPending || notifications.data.unreadCount === 0}
            >
              Read all
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {notifications.data.items.length === 0 ? (
          <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4 text-sm text-[color:var(--muted)]">
            Inbox is empty.
          </div>
        ) : (
          notifications.data.items.map((item) => (
            <NotificationRow key={item.id} item={item} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function NotificationRow({
  item,
}: {
  readonly item: NonNullable<ReturnType<typeof useNotifications>["data"]>["items"][number];
}) {
  const markRead = useMarkNotificationRead(item.id);

  return (
    <div className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariantForStatus(item.severity)}>{item.severity}</Badge>
            <Badge variant="muted">{item.type}</Badge>
            <Badge variant="muted">{item.priority}</Badge>
            {item.readAt ? <Badge variant="success">read</Badge> : <Badge variant="accent">unread</Badge>}
          </div>
          <div className="text-sm font-medium">{item.title}</div>
          <div className="text-sm text-[color:var(--muted)]">{item.body}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.actionUrl ? (
            <Button asChild size="sm">
              <Link href={item.actionUrl}>Open</Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markRead.mutateAsync()}
            disabled={markRead.isPending || Boolean(item.readAt)}
          >
            Mark read
          </Button>
        </div>
      </div>
    </div>
  );
}
