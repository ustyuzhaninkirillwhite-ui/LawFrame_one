import type { NotificationSummary } from "@lexframe/contracts";
import { describe, expect, it } from "vitest";
import {
  classifyNotificationTarget,
  countSidebarNotifications,
} from "./sidebar-notifications";

function notification(
  overrides: Partial<NotificationSummary>,
): NotificationSummary {
  return {
    id: "notification_1",
    workspaceId: "workspace_1",
    userId: "user_1",
    type: "system.info",
    title: "Test",
    body: "Body",
    severity: "info",
    priority: "normal",
    actionUrl: null,
    entityType: null,
    entityId: null,
    metadata: {},
    readAt: null,
    createdAt: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("sidebar notifications", () => {
  it("classifies chat and ai-session notifications", () => {
    expect(
      classifyNotificationTarget(
        notification({
          entityType: "chat",
          actionUrl: "/app/projects/project_claim_001/chats/chat_1",
        }),
      ),
    ).toBe("chat");

    expect(
      classifyNotificationTarget(
        notification({
          type: "ai_session.message",
          metadata: {
            target: "conversation",
          },
        }),
      ),
    ).toBe("chat");
  });

  it("classifies automation, run and approval notifications", () => {
    expect(
      classifyNotificationTarget(
        notification({
          entityType: "run",
          actionUrl: "/app/runs/run_1",
        }),
      ),
    ).toBe("automation");

    expect(
      classifyNotificationTarget(
        notification({
          type: "approval.required",
          actionUrl: "/app/projects/project_claim_001/automations/automation_1",
        }),
      ),
    ).toBe("automation");
  });

  it("counts targets for sidebar badges", () => {
    expect(
      countSidebarNotifications([
        notification({ entityType: "chat" }),
        notification({ entityType: "automation" }),
        notification({ type: "runtime.degraded" }),
        notification({ entityType: "document" }),
      ]),
    ).toEqual({
      automation: 2,
      chat: 1,
      other: 1,
    });
  });
});
