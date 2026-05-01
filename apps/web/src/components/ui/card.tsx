import { cardRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import type * as React from "react";
import { localizeNode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardRecipe.base, className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardRecipe.header, className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn(cardRecipe.title, className)} {...props}>{localizeNode(children)}</h3>;
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn(cardRecipe.description, className)} {...props}>{localizeNode(children)}</p>;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardRecipe.content, className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardRecipe.footer, className)} {...props} />;
}
