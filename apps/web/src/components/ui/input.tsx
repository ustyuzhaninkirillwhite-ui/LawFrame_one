import * as React from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, placeholder, ...props }, ref) => {
    return (
      <input
        ref={ref}
        placeholder={placeholder ? t(placeholder) : undefined}
        className={cn(
          "h-11 w-full rounded-full border border-[color:var(--line)] bg-white/4 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
