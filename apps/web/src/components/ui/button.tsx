"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { localizeNode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 text-[#101319] shadow-[0_16px_35px_rgba(199,164,106,0.18)] hover:bg-[color:var(--accent-strong)]",
        ghost:
          "border-[color:var(--line)] bg-transparent px-4 py-2 text-[color:var(--foreground)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]",
        subtle:
          "border-transparent bg-white/6 px-4 py-2 text-[color:var(--foreground)] hover:bg-white/10",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
      },
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
