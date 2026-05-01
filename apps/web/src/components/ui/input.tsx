import { formRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import * as React from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, placeholder, ...props }, ref) => {
    return (
      <input
        ref={ref}
        placeholder={placeholder ? t(placeholder) : undefined}
        className={cn(formRecipe.input, className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
