import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

test.describe("stage11 security control plane", () => {
  test("security admin sees release gates on overview", async ({ page }) => {
    await signInAsDemo(page, {
      email: `security-${Date.now()}@lexframe.local`,
      fullName: "Security Admin",
    });

    await page.getByRole("link", { name: "Admin / Security" }).click();
    await expect(
      page.getByText("Release gates stay visible to the team long before the first beta."),
    ).toBeVisible();
    await expect(page.getByText("Current Stage 11 blockers")).toBeVisible();
  });

  test("security admin can open sessions, secrets and incidents panels", async ({
    page,
  }) => {
    await signInAsDemo(page, {
      email: `security-panels-${Date.now()}@lexframe.local`,
      fullName: "Security Panels",
    });

    await page.getByRole("link", { name: "Admin / Security" }).click();
    await page.getByRole("link", { name: "sessions" }).click();
    await expect(page.getByText("Session inventory and revocation")).toBeVisible();

    await page.getByRole("link", { name: "secrets" }).click();
    await expect(page.getByText("Secrets inventory and rotation")).toBeVisible();

    await page.getByRole("link", { name: "incidents" }).click();
    await expect(page.getByText("Incidents and containment")).toBeVisible();
  });

  test("activepieces governance panel exposes token and runtime controls", async ({
    page,
  }) => {
    await signInAsDemo(page, {
      email: `builder-security-${Date.now()}@lexframe.local`,
      fullName: "Builder Security",
    });

    await page.getByRole("link", { name: "Admin / Security" }).click();
    await page.getByRole("link", { name: "activepieces" }).click();
    await expect(page.getByText("Activepieces governance")).toBeVisible();
    await expect(page.getByText("token TTL", { exact: true })).toBeVisible();
    await expect(page.getByText("incident lock", { exact: true })).toBeVisible();
  });
});
