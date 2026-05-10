"use client";

import { Dialog } from "@/components/ui/dialog";
import { SettingsShell } from "./settings-shell";

export function SettingsDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      className="max-h-[calc(100vh-2rem)] overflow-auto"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <SettingsShell mode="dialog" onClose={onClose} />
    </Dialog>
  );
}
