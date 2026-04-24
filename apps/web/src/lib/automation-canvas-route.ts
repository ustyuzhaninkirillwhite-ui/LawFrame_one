export function isAutomationCanvasRoute(pathname: string | null | undefined) {
  return Boolean(pathname?.match(/^\/app\/projects\/[^/]+\/automations\/?$/));
}

export function isProjectWorkspaceRoute(pathname: string | null | undefined) {
  return Boolean(pathname?.match(/^\/app\/projects\/[^/]+\/?$/));
}
