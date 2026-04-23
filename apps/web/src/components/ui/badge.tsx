import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { localizeNode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.24em]",
  {
    variants: {
      variant: {
        accent: "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent-strong)]",
        muted: "border-[color:var(--line)] bg-white/4 text-[color:var(--muted)]",
        success: "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]",
        danger: "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props}>{localizeNode(children)}</div>;
}
