import { skeletonRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(skeletonRecipe.base, className)} {...props} />;
}
