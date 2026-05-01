import { formRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(formRecipe.select, className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";
