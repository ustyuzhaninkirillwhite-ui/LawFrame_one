"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { SettingsShell } from "./settings-shell";

export function SettingsDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <Dialog
      open={open}
      aria-label="Настройки"
      className="max-h-[calc(100vh-2rem)] overflow-auto"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
          return;
        }
        if (event.key === "Tab") {
          trapDialogTab(event);
        }
      }}
    >
      <SettingsShell mode="dialog" onClose={onClose} />
    </Dialog>
  );
}

function trapDialogTab(event: React.KeyboardEvent<HTMLDivElement>) {
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => element.offsetParent !== null);

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  const active = document.activeElement;

  if (!active || !event.currentTarget.contains(active)) {
    event.preventDefault();
    first.focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
