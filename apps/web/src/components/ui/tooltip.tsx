import { overlayRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  children,
  className,
  label,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden -translate-x-1/2 whitespace-nowrap group-hover:block group-focus-within:block",
          overlayRecipe.tooltip,
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
