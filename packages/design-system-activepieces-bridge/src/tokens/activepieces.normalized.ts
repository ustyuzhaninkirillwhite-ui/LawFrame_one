import type { TokenValue } from "./token-types";

export const activepiecesNormalizedTokens = {
  color: {
    backgroundPage: token("background.page", "#0a0a0a"),
    backgroundCard: token("background.card", "#171717"),
    backgroundPanel: token("background.panel", "#1f1f1f"),
    backgroundMuted: token("background.muted", "#262626"),
    foregroundPrimary: token("foreground.primary", "#fafafa"),
    foregroundSecondary: token("foreground.secondary", "#e5e5e5"),
    foregroundMuted: token("foreground.muted", "#a3a3a3"),
    borderDefault: token("border.default", "rgba(255, 255, 255, 0.08)"),
    borderInput: token("border.input", "rgba(255, 255, 255, 0.08)"),
    focusRing: token("focus.ring", "#737373"),
    primary: token("primary", "hsl(210 90% 50%)"),
    primaryHover: token("primary.hover", "hsl(210 90% 56%)"),
    primaryForeground: token("primary.foreground", "#f8fafc"),
    success: token("success", "hsl(160 60% 52%)"),
    warning: token("warning", "hsl(43 97% 56%)"),
    destructive: token("destructive", "hsl(351 95% 72%)"),
    info: token("info", "hsl(214 16% 70%)"),
  },
  radius: {
    control: token("radius.control", "0.5rem"),
    card: token("radius.card", "0.75rem"),
    panel: token("radius.panel", "0.75rem"),
    badge: token("radius.badge", "9999px"),
  },
  shadow: {
    card: token("shadow.card", "0 1px 2px rgba(0, 0, 0, 0.18)"),
    panel: token("shadow.panel", "0 14px 34px rgba(0, 0, 0, 0.28)"),
    popover: token("shadow.popover", "0 18px 48px rgba(0, 0, 0, 0.34)"),
  },
  spacing: {
    pageX: token("spacing.page.x", "1.5rem"),
    pageY: token("spacing.page.y", "1.5rem"),
    panel: token("spacing.panel", "1.5rem"),
    controlX: token("spacing.control.x", "0.75rem"),
    controlY: token("spacing.control.y", "0.5rem"),
    navItem: token("spacing.nav.item", "0.5rem"),
  },
  typography: {
    fontSans: token("typography.font.sans", "Inter, ui-sans-serif, system-ui, sans-serif"),
    bodySize: token("typography.body.size", "0.875rem"),
    headingWeight: token("typography.heading.weight", "600"),
    metadataSize: token("typography.metadata.size", "0.75rem"),
    diagnosticSize: token("typography.diagnostic.size", "0.75rem"),
  },
} as const;

function token(name: string, value: string): TokenValue {
  return {
    name,
    value,
    source: "derived",
  };
}
