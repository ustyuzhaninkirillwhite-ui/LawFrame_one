import { expect, type Page } from "@playwright/test";
import { assertNoOldProjectDashboard } from "./visual-invariants";

export const projectTabNamePattern = {
  chats: /С‡Р°С‚С‹|Чаты|chats/i,
  sources: /РёСЃС‚РѕС‡РЅРёРєРё|Источники|sources/i,
  automations: /Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё|Автоматизации|automations/i,
} as const;

export async function openProjectWorkspace(page: Page, projectId: string) {
  await page.goto(`/app/projects/${projectId}`);
  await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
    timeout: 20_000,
  });
}

export async function assertProjectWorkspaceReady(page: Page) {
  await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
    timeout: 20_000,
  });
  await assertNoOldProjectDashboard(page);
  await expect(page.getByRole("tab", { name: projectTabNamePattern.chats })).toBeVisible();
  await expect(page.getByRole("tab", { name: projectTabNamePattern.sources })).toBeVisible();
  await expect(page.getByRole("tab", { name: projectTabNamePattern.automations })).toBeVisible();
}

export async function renameProjectFromHeader(page: Page, nextName: string) {
  const shell = page.getByTestId("project-workspace-shell");
  await shell
    .getByRole("button", {
      name: /РїРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ|Переименовать|rename/i,
    })
    .click();
  const nameInput = shell.getByRole("textbox", {
    name: /РЅР°Р·РІР°РЅРёРµ РїСЂРѕРµРєС‚Р°|Название проекта|project name/i,
  });
  await nameInput.fill(nextName);
  await nameInput.press("Enter");
  await expect(page.getByRole("heading", { name: nextName })).toBeVisible({
    timeout: 20_000,
  });
}

export async function openProjectTab(
  page: Page,
  tabName: "chats" | "sources" | "automations",
) {
  await page.getByRole("tab", { name: projectTabNamePattern[tabName] }).click();
  await expect(page.getByRole("tab", { name: projectTabNamePattern[tabName] })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}
