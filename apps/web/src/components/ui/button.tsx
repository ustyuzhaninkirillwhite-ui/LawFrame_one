"use client";

import { Slot } from "@radix-ui/react-slot";
import { buttonRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { localizeNode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  buttonRecipe.base,
  {
    variants: {
      variant: buttonRecipe.variants,
      size: buttonRecipe.sizes,
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{localizeNode(children)}</Comp>;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
