export const activepiecesPreset = {
  theme: {
    extend: {
      colors: {
        "lf-bg": "var(--lf-bg-app)",
        "lf-card": "var(--lf-bg-card)",
        "lf-panel": "var(--lf-bg-panel)",
        "lf-muted": "var(--lf-bg-muted)",
        "lf-foreground": "var(--lf-text-primary)",
        "lf-muted-foreground": "var(--lf-text-muted)",
        "lf-border": "var(--lf-border)",
        "lf-ring": "var(--lf-ring)",
        "lf-primary": "var(--lf-primary)",
        "lf-primary-foreground": "var(--lf-primary-fg)",
        "lf-success": "var(--lf-success)",
        "lf-warning": "var(--lf-warning)",
        "lf-destructive": "var(--lf-destructive)",
        "lf-info": "var(--lf-info)",
      },
      borderRadius: {
        "lf-control": "var(--lf-radius-control)",
        "lf-card": "var(--lf-radius-card)",
        "lf-panel": "var(--lf-radius-panel)",
      },
      boxShadow: {
        "lf-card": "var(--lf-shadow-card)",
        "lf-panel": "var(--lf-shadow-panel)",
        "lf-popover": "var(--lf-shadow-popover)",
      },
      fontFamily: {
        "lf-sans": "var(--lf-font-sans)",
      },
    },
  },
} as const;
