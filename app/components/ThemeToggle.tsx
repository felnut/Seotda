"use client";

import { useSyncExternalStore } from "react";
import { MODE_STORAGE_KEY } from "@/lib/themes";

const MODE_EVENT = "seotda-mode-change";
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== MODE_STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.mode =
      event.newValue === "alt" ? "alt" : "default";
    onChange();
  };
  window.addEventListener(MODE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MODE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemeMode() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.mode === "alt",
    () => false,
  );
  const toggle = () => {
    const next =
      document.documentElement.dataset.mode === "alt" ? "default" : "alt";
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(MODE_EVENT));
  };
  return { looksLight: !dark, toggle };
}

export default function ThemeToggle() {
  const { looksLight, toggle } = useThemeMode();
  const label = looksLight ? "다크 모드로 전환" : "라이트 모드로 전환";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="in-[.has-menu-theme]:hidden fixed bottom-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-zinc-100"
    >
      <span aria-hidden="true">{looksLight ? "◐" : "◑"}</span>
    </button>
  );
}
