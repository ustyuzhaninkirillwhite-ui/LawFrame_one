import { overlayRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function ToastViewport({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("fixed bottom-4 right-4 z-50 grid w-[min(100%-2rem,360px)] gap-2", className)}
      {...props}
    />
  );
}

export function Toast({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="status" className={cn(overlayRecipe.toast, className)} {...props} />;
}

export function ToastTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm font-semibold", className)} {...props} />;
}

export function ToastDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-1 text-sm text-[color:var(--lf-text-muted)]", className)} {...props} />;
}
