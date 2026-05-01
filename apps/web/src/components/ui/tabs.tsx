"use client";

import { tabsRecipe } from "@lexframe/design-system-activepieces-bridge/recipes";
import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  readonly value: string;
  readonly setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  className,
  defaultValue,
  onValueChange,
  value,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;
  const context = React.useMemo<TabsContextValue>(
    () => ({
      value: currentValue,
      setValue: (nextValue) => {
        setInternalValue(nextValue);
        onValueChange?.(nextValue);
      },
    }),
    [currentValue, onValueChange],
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={cn(tabsRecipe.root, className)} {...props} />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn(tabsRecipe.list, className)} {...props} />;
}

export function TabsTrigger({
  className,
  value,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { readonly value: string }) {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      className={cn(tabsRecipe.trigger, className)}
      onClick={() => context.setValue(value)}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  value,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { readonly value: string }) {
  const context = useTabsContext();
  const active = context.value === value;

  if (!active) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      data-state="active"
      className={cn(tabsRecipe.content, className)}
      {...props}
    />
  );
}

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be rendered inside <Tabs>.");
  }
  return context;
}
