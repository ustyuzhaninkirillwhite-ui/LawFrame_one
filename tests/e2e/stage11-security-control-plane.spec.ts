import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

test.describe("stage11 security control plane", () => {
  test("security admin sees release gates on overview", async ({ page }) => {
    await signInAsDemo(page, {
      email: `security-${Date.now()}@lexframe.local`,
      fullName: "Security Admin",
    });

    await page.goto("/admin/security");
    await expect(
      page.getByRole("heading", { name: "Security overview and release gates" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Current Stage 11 blockers")).toBeVisible();
  });

  test("security admin can open sessions, secrets and incidents panels", async ({
    page,
  }) => {
    await signInAsDemo(page, {
      email: `security-panels-${Date.now()}@lexframe.local`,
      fullName: "Security Panels",
    });

    await page.goto("/admin/security");
    await page.getByRole("link", { name: "sessions" }).click();
    await expect(
      page.getByRole("heading", { name: "Session inventory and revocation" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "secrets" }).click();
    await expect(page).toHaveURL(/\/admin\/security\/secrets$/);
    await expect(
      page.getByRole("heading", { name: "Secrets inventory and rotation" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "incidents" }).click();
    await expect(page).toHaveURL(/\/admin\/security\/incidents$/);
    await expect(
      page.getByRole("heading", { name: "Incidents and containment" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("activepieces governance panel exposes token and runtime controls", async ({
    page,
  }) => {
    await signInAsDemo(page, {
      email: `builder-security-${Date.now()}@lexframe.local`,
      fullName: "Builder Security",
    });

    await page.goto("/admin/security");
    await page.getByRole("link", { name: "activepieces" }).click();
    await expect(page.getByText("Activepieces governance")).toBeVisible();
    await expect(page.getByText("token TTL", { exact: true })).toBeVisible();
    await expect(page.getByText("incident lock", { exact: true })).toBeVisible();
  });
});
