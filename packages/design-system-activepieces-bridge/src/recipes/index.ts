export const buttonRecipe = {
  base: [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--lf-radius-control)] border text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)]",
    "disabled:pointer-events-none disabled:opacity-[var(--lf-state-disabled-opacity)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  variants: {
    default: "border-transparent bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] hover:bg-[color:var(--lf-primary-hover)]",
    ghost: "border-transparent bg-transparent text-[color:var(--lf-text-secondary)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
    subtle: "border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] text-[color:var(--lf-text-primary)] hover:bg-[color:var(--lf-bg-muted)]",
    outline: "border-[color:var(--lf-border-input)] bg-transparent text-[color:var(--lf-text-primary)] hover:bg-[color:var(--lf-state-hover)]",
    destructive: "border-transparent bg-[color:var(--lf-destructive)] text-white hover:opacity-90",
    link: "border-transparent bg-transparent px-0 text-[color:var(--lf-primary)] underline-offset-4 hover:underline",
  },
  sizes: {
    default: "h-9 px-3 py-2",
    sm: "h-8 px-2.5 text-xs",
    lg: "h-10 px-5",
    icon: "size-9 px-0",
  },
} as const;

export const badgeRecipe = {
  base: "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--lf-radius-badge)] border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)]",
  variants: {
    accent: "border-[color:var(--lf-primary)]/40 bg-[color:var(--lf-primary)]/15 text-[color:var(--lf-primary-hover)]",
    muted: "border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] text-[color:var(--lf-text-muted)]",
    success: "border-[color:var(--lf-success)]/45 bg-[color:var(--lf-success)]/12 text-[color:var(--lf-success)]",
    danger: "border-[color:var(--lf-destructive)]/45 bg-[color:var(--lf-state-error-surface)] text-[color:var(--lf-destructive)]",
    warning: "border-[color:var(--lf-warning)]/45 bg-[color:var(--lf-warning)]/12 text-[color:var(--lf-warning)]",
    info: "border-[color:var(--lf-info)]/45 bg-[color:var(--lf-info)]/12 text-[color:var(--lf-info)]",
  },
} as const;

export const cardRecipe = {
  base: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] text-[color:var(--lf-text-primary)] shadow-[var(--lf-shadow-card)]",
  interactive: "transition-colors hover:border-[color:var(--lf-state-selected-border)] hover:bg-[color:var(--lf-bg-panel)]",
  selected: "border-[color:var(--lf-state-selected-border)] bg-[color:var(--lf-state-active)]",
  header: "flex flex-col gap-1.5 p-6",
  title: "text-lg font-semibold leading-none tracking-normal",
  description: "text-sm leading-6 text-[color:var(--lf-text-muted)]",
  content: "p-6 pt-0",
  footer: "flex items-center gap-3 p-6 pt-0",
} as const;

export const formRecipe = {
  input: "h-9 w-full rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border-input)] bg-[color:var(--lf-bg-card)] px-3 text-sm text-[color:var(--lf-text-primary)] outline-none transition-colors placeholder:text-[color:var(--lf-text-muted)] focus-visible:border-[color:var(--lf-ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--lf-state-disabled-opacity)]",
  textarea: "min-h-28 w-full rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border-input)] bg-[color:var(--lf-bg-card)] px-3 py-3 text-sm text-[color:var(--lf-text-primary)] outline-none transition-colors placeholder:text-[color:var(--lf-text-muted)] focus-visible:border-[color:var(--lf-ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--lf-state-disabled-opacity)]",
  select: "h-9 w-full rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border-input)] bg-[color:var(--lf-bg-card)] px-3 text-sm text-[color:var(--lf-text-primary)] outline-none transition-colors focus-visible:border-[color:var(--lf-ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)]",
  label: "text-sm font-medium text-[color:var(--lf-text-primary)]",
  helper: "text-xs leading-5 text-[color:var(--lf-text-muted)]",
} as const;

export const navigationRecipe = {
  item: "relative flex min-h-9 items-center gap-2 rounded-[var(--lf-radius-control)] border px-3 py-2 text-sm transition-colors",
  inactive: "border-transparent text-[color:var(--lf-text-muted)] hover:border-[color:var(--lf-border)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
  active: "border-[color:var(--lf-primary)]/40 bg-[color:var(--lf-state-active)] text-[color:var(--lf-text-primary)]",
  railItem: "flex size-10 items-center justify-center rounded-[var(--lf-radius-control)] border transition-colors",
  section: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)] p-4",
} as const;

export const panelRecipe = {
  shell: "rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] shadow-[var(--lf-shadow-panel)]",
  muted: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)]",
  empty: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-state-empty-surface)]",
  error: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-destructive)]/45 bg-[color:var(--lf-state-error-surface)]",
} as const;

export const tableRecipe = {
  wrapper: "w-full overflow-auto rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)]",
  table: "w-full caption-bottom text-sm",
  header: "border-b border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)]",
  row: "border-b border-[color:var(--lf-border)] transition-colors hover:bg-[color:var(--lf-state-hover)] data-[state=selected]:bg-[color:var(--lf-state-active)]",
  head: "h-10 px-3 text-left align-middle text-xs font-medium uppercase text-[color:var(--lf-text-muted)]",
  cell: "p-3 align-middle text-[color:var(--lf-text-primary)]",
} as const;

export const overlayRecipe = {
  popover: "rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-3 text-[color:var(--lf-text-primary)] shadow-[var(--lf-shadow-popover)]",
  dialog: "rounded-[var(--lf-radius-panel)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-6 text-[color:var(--lf-text-primary)] shadow-[var(--lf-shadow-popover)]",
  sheet: "border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-6 text-[color:var(--lf-text-primary)] shadow-[var(--lf-shadow-popover)]",
  tooltip: "rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-2 py-1 text-xs text-[color:var(--lf-text-secondary)] shadow-[var(--lf-shadow-popover)]",
  toast: "rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] p-4 text-sm text-[color:var(--lf-text-primary)] shadow-[var(--lf-shadow-popover)]",
} as const;

export const tabsRecipe = {
  root: "flex flex-col gap-3",
  list: "inline-flex w-fit items-center rounded-[var(--lf-radius-control)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] p-1",
  trigger: "rounded-[calc(var(--lf-radius-control)-2px)] px-3 py-1.5 text-sm text-[color:var(--lf-text-muted)] transition-colors hover:text-[color:var(--lf-text-primary)] data-[state=active]:bg-[color:var(--lf-bg-card)] data-[state=active]:text-[color:var(--lf-text-primary)]",
  content: "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lf-ring)]",
} as const;

export const skeletonRecipe = {
  base: "animate-pulse rounded-[var(--lf-radius-control)] bg-[color:var(--lf-state-skeleton)]",
} as const;
