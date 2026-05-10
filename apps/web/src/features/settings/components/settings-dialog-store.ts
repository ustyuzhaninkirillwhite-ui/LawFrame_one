"use client";

import { create } from "zustand";

interface SettingsDialogState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
