"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "@/lib/themes";

function subscribe(callback: () => void) {
  window.addEventListener("seotda-theme-change", callback);
  return () => window.removeEventListener("seotda-theme-change", callback);
}

export function useThemeMode() {
  const theme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? DEFAULT_THEME,
    () => DEFAULT_THEME,
  );

  const setTheme = (id: string) => {
    if (!THEMES.some((item) => item.id === id)) return;
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch {}
    window.dispatchEvent(new Event("seotda-theme-change"));
  };

  return { theme, setTheme };
}
