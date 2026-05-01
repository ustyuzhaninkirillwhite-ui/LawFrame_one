import { formRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
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
      className={cn(formRecipe.textarea, className)}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
