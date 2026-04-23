import * as React from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, placeholder, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      placeholder={placeholder ? t(placeholder) : undefined}
      className={cn(
        "min-h-32 w-full rounded-[24px] border border-[color:var(--line)] bg-white/4 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)]",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
