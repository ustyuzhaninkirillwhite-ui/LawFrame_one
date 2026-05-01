"use client";

import { overlayRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Dropdown({
  children,
  className,
  trigger,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="contents"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div role="menu" className={cn("absolute right-0 top-full z-40 mt-2 min-w-48", overlayRecipe.popover, className)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--lf-radius-control)] px-2 py-1.5 text-left text-sm text-[color:var(--lf-text-secondary)] hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}
