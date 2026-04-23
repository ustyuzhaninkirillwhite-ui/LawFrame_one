import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

test("builder readiness exposes governance and token controls", async ({ page }) => {
  await signInAsDemo(page, {
    email: `builder-${Date.now()}@lexframe.local`,
    fullName: "Builder Owner",
  });

  await page.getByRole("link", { name: "Admin / Security" }).click();
  await page.getByRole("link", { name: "activepieces" }).click();
  await expect(page.getByText("Activepieces governance")).toBeVisible();
  await expect(page.getByText("token TTL", { exact: true })).toBeVisible();
  await expect(page.getByText("incident lock", { exact: true })).toBeVisible();
});
