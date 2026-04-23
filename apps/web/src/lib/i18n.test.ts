import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatPermission,
  formatRole,
  formatStatus,
  t,
} from "./i18n";

describe("RU-first i18n helpers", () => {
  it("translates fixed UI labels and status codes", () => {
    expect(t("Dashboard")).toBe("Обзор");
    expect(formatStatus("waiting_delivery_approval")).toBe(
      "ожидает согласования отправки",
    );
    expect(formatRole("security_admin")).toBe("Администратор безопасности");
  });

  it("maps permission codes without changing the machine-readable code", () => {
    expect(formatPermission("approval.task.decide")).toEqual({
      label: "Решение задач согласования",
      description: "Согласование, отклонение или запрос правок.",
    });
  });

  it("formats dates with Russian locale and keeps invalid values visible", () => {
    expect(formatDateTime(null)).toBe("не указано");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("2026-04-23T08:30:00.000Z")).toContain("2026");
  });
});
