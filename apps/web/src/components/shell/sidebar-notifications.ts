import type { NotificationSummary } from "@lexframe/contracts";

export type SidebarNotificationTarget = "chat" | "automation" | "other";

const chatTokens = ["chat", "ai_session", "ai-session", "conversation", "message"];
const automationTokens = [
  "automation",
  "workflow",
  "run",
  "approval",
  "runtime",
  "activepieces",
  "materialize",
  "connection",
];

export function classifyNotificationTarget(
  notification: NotificationSummary,
): SidebarNotificationTarget {
  const haystack = [
    notification.entityType,
    notification.type,
    notification.actionUrl,
    JSON.stringify(notification.metadata ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  if (automationTokens.some((token) => haystack.includes(token))) {
    return "automation";
  }

  if (chatTokens.some((token) => haystack.includes(token))) {
    return "chat";
  }

  return "other";
}

export function countSidebarNotifications(
  notifications: readonly NotificationSummary[],
): Record<SidebarNotificationTarget, number> {
  return notifications.reduce<Record<SidebarNotificationTarget, number>>(
    (counts, notification) => {
      counts[classifyNotificationTarget(notification)] += 1;
      return counts;
    },
    {
      automation: 0,
      chat: 0,
      other: 0,
    },
  );
}
