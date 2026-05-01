import type { LexFrameTokenMapping } from "./token-types";

export const lexFrameToActivepiecesTokenMap = [
  map("color.background", "--lf-bg-app", "color", "body, AppShell, page wrapper", "LexFrame page background follows AP builder dark surface rhythm."),
  map("color.surface.card", "--lf-bg-card", "color", "Card, ProjectCard, AutomationCard, DocumentCard, RunCard", "Cards use AP border-first low-shadow surfaces."),
  map("color.surface.panel", "--lf-bg-panel", "color", "Inspector-like side panels, diagnostics, admin panels", "Panels visually continue AP inspector/settings language."),
  map("color.surface.muted", "--lf-bg-muted", "color", "Empty states, muted rows, secondary controls", "Muted surfaces remain distinct from active cards."),
  map("color.text.primary", "--lf-text-primary", "color", "Primary text", "Text contrast remains WCAG-compliant."),
  map("color.text.muted", "--lf-text-muted", "color", "Descriptions, metadata, disabled copy", "Muted text remains readable against AP-like dark surfaces."),
  map("color.border", "--lf-border", "border", "Cards, panels, tables, dividers", "LexFrame uses AP low-contrast border-first elevation."),
  map("color.border.input", "--lf-border-input", "border", "Inputs, selects, textareas", "Inputs use AP border/focus model."),
  map("color.focus", "--lf-ring", "border", "Keyboard focus rings", "Visible focus is mandatory and cannot be removed for visual simplification."),
  map("color.primary", "--lf-primary", "color", "Primary actions, active route marker", "Action semantics remain LexFrame; color language follows AP."),
  map("color.primary.foreground", "--lf-primary-fg", "color", "Primary action foreground", "Primary foreground must pass contrast."),
  map("color.success", "--lf-success", "color", "Ready/synced/completed statuses", "LexFrame status taxonomy is preserved."),
  map("color.warning", "--lf-warning", "color", "Pending/degraded/waiting states", "Warnings stay visually separate from success/error."),
  map("color.destructive", "--lf-destructive", "color", "Error/blocked/failed states", "No raw provider payload or secret appears in error UI."),
  map("color.info", "--lf-info", "color", "AI route, runtime notices, diagnostic hints", "Informational UI must not imply AP ownership of LexFrame AI semantics."),
  map("radius.control", "--lf-radius-control", "radius", "Buttons, inputs, selects, nav items", "Controls converge on AP rounded-md density."),
  map("radius.card", "--lf-radius-card", "radius", "Cards and repeated items", "Cards avoid old oversized LexFrame radius."),
  map("radius.panel", "--lf-radius-panel", "radius", "Page panels, sheets, dialogs", "Panels remain compact and AP-like."),
  map("shadow.card", "--lf-shadow-card", "shadow", "Cards", "Card shadows stay low; borders carry most separation."),
  map("shadow.panel", "--lf-shadow-panel", "shadow", "AppShell panel and side panels", "Panel elevation must not compete with Canvas."),
  map("shadow.popover", "--lf-shadow-popover", "shadow", "Dropdowns, tooltips, menus", "Overlay shadows follow AP popover language."),
  map("spacing.page", "--lf-space-page", "spacing", "Route page padding", "Route pages share AP horizontal rhythm."),
  map("spacing.panel", "--lf-space-panel", "spacing", "Cards and panels", "Component density stays consistent across routes."),
  map("spacing.control", "--lf-space-control-x", "spacing", "Button/input horizontal padding", "Control sizes align with AP defaults."),
  map("typography.body", "--lf-font-sans", "typography", "Body, shell, component text", "LexFrame shell adopts AP sans stack."),
  map("typography.heading", "--lf-heading-weight", "typography", "Headings and card titles", "Heading scale is restrained inside operational surfaces."),
  map("state.hover", "--lf-state-hover", "componentState", "Hoverable cards, nav, controls", "Hover state cannot be hue-only."),
  map("state.active", "--lf-state-active", "componentState", "Active route, selected tab, selected card", "Selected state uses surface plus border."),
  map("state.disabled", "--lf-state-disabled-opacity", "componentState", "Disabled controls", "Disabled controls remain perceivable and expose reason where applicable."),
  map("state.skeleton", "--lf-state-skeleton", "componentState", "Loading placeholders", "Loading states converge without custom route pulses."),
  map("state.error", "--lf-state-error-surface", "componentState", "Error panels", "Safe detail only; no raw secrets or provider payloads."),
  map("state.empty", "--lf-state-empty-surface", "componentState", "Empty states", "Empty states use one AP-like recipe."),
] as const satisfies readonly LexFrameTokenMapping[];

function map(
  lexFrameToken: string,
  activepiecesBridgeToken: string,
  category: LexFrameTokenMapping["category"],
  usage: string,
  acceptanceNote: string,
): LexFrameTokenMapping {
  return {
    lexFrameToken,
    activepiecesBridgeToken,
    category,
    usage,
    acceptanceNote,
  };
}
