"use client";

import { Settings } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "./settings-dialog";
import { useSettingsDialogStore } from "./settings-dialog-store";

export function SettingsButton({
  collapsed,
  className,
}: {
  readonly collapsed?: boolean;
  readonly className?: string;
}) {
  const open = useSettingsDialogStore((state) => state.open);
  const setOpen = useSettingsDialogStore((state) => state.setOpen);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          collapsed ? "h-12 w-12 rounded-[18px] px-0" : "w-full justify-start",
          className,
        )}
        aria-label="Настройки"
        title="Настройки"
        data-testid="settings-entry-point"
        onClick={() => setOpen(true)}
      >
        <Settings size={collapsed ? 18 : 16} />
        {collapsed ? null : <span>Настройки</span>}
      </Button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
