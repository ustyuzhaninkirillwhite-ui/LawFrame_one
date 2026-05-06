"use client";

import * as React from "react";

export type LexFrameTheme = "light" | "dark";

interface ThemeContextValue {
  readonly theme: LexFrameTheme;
  readonly setTheme: (theme: LexFrameTheme) => void;
  readonly toggleTheme: () => void;
}

const storageKey = "lexframe-ui-theme";
const defaultTheme: LexFrameTheme = "light";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<LexFrameTheme>(readStoredTheme);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = React.useCallback((nextTheme: LexFrameTheme) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Theme persistence is optional in restricted browser contexts.
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch {
        // Theme persistence is optional in restricted browser contexts.
      }
      return nextTheme;
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

function readStoredTheme(): LexFrameTheme {
  if (typeof window === "undefined") {
    return defaultTheme;
  }

  try {
    return normalizeTheme(window.localStorage.getItem(storageKey));
  } catch {
    return defaultTheme;
  }
}

function normalizeTheme(value: string | null): LexFrameTheme {
  return value === "dark" ? "dark" : defaultTheme;
}

function applyTheme(theme: LexFrameTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}
