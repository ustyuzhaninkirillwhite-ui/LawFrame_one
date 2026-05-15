import { overlayRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  children,
  className,
  open = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { readonly open?: boolean }) {
  if (!open) {
    return null;
  }

  const {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rootProps
  } = props;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[color:var(--lf-bg-app)]/70 p-4 backdrop-blur-sm"
      {...rootProps}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(overlayRecipe.dialog, className)}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-[color:var(--lf-text-muted)]", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-wrap justify-end gap-2", className)} {...props} />;
}
