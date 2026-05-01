import { badgeRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { localizeNode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  badgeRecipe.base,
  {
    variants: {
      variant: badgeRecipe.variants,
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
