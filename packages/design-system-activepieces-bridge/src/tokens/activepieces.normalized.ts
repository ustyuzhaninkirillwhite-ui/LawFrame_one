import type { TokenValue } from "./token-types";

export const activepiecesNormalizedTokens = {
  color: {
    backgroundPage: token("background.page", "#ffffff"),
    backgroundCard: token("background.card", "#ffffff"),
    backgroundPanel: token("background.panel", "#fafafa"),
    backgroundMuted: token("background.muted", "#f5f5f5"),
    foregroundPrimary: token("foreground.primary", "#0a0a0a"),
    foregroundSecondary: token("foreground.secondary", "#171717"),
    foregroundMuted: token("foreground.muted", "#737373"),
    borderDefault: token("border.default", "#e5e5e5"),
    borderInput: token("border.input", "#e5e5e5"),
    focusRing: token("focus.ring", "#a3a3a3"),
    primary: token("primary", "hsl(257 74% 57%)"),
    primaryHover: token("primary.hover", "hsl(257 74% 48%)"),
    primaryForeground: token("primary.foreground", "#f8fafc"),
    domainPrimary: token("domain.primary", "#1688fe"),
    domainPrimaryHover: token("domain.primary.hover", "#0f6fd7"),
    success: token("success", "hsl(160 60% 52%)"),
    warning: token("warning", "hsl(43 97% 56%)"),
    destructive: token("destructive", "hsl(350 89% 60%)"),
    info: token("info", "#1890ff"),
  },
  radius: {
    control: token("radius.control", "0.5rem"),
    card: token("radius.card", "0.75rem"),
    panel: token("radius.panel", "0.75rem"),
    badge: token("radius.badge", "9999px"),
  },
  shadow: {
    card: token("shadow.card", "0 1px 2px rgba(15, 23, 42, 0.06)"),
    panel: token("shadow.panel", "0 14px 34px rgba(15, 23, 42, 0.08)"),
    popover: token("shadow.popover", "0 18px 48px rgba(15, 23, 42, 0.14)"),
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
