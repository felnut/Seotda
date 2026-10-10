"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  MODE_STORAGE_KEY as STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEMES,
} from "@/lib/themes";
const FADE_MS = 450;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

// 테마 원래 밝기는 CSS 변수로 둔다(--native-light: 1 = 원래 밝은 테마).
function readNativeLight() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--native-light")
      .trim() === "1"
  );
}

// 테마(data-theme)와 모드(data-mode) 상태 — 떠 있는 버튼과 로비 햄버거 메뉴가
// 같은 로직을 쓴다. 진짜 상태는 <html>의 data 속성에 있고, 여기서는 그 값을 따라간다.
export function useThemeMode() {
  const [alt, setAlt] = useState(false);
  const [nativeLight, setNativeLight] = useState(false);
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    // 마운트 이후에만 DOM/localStorage를 읽을 수 있어 effect에서 동기화한다.
    // (SSR HTML과의 하이드레이션 불일치를 피하려고 저장된 선택도 여기서 적용)
    let saved = document.documentElement.dataset.mode === "alt";
    try {
      if (!saved) saved = localStorage.getItem(STORAGE_KEY) === "alt";
    } catch {}
    if (saved) document.documentElement.dataset.mode = "alt";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlt(saved);
    setNativeLight(readNativeLight());
    setThemeState(document.documentElement.dataset.theme ?? DEFAULT_THEME);
  }, []);

  const setTheme = (id: string) => {
    if (!THEMES.some((item) => item.id === id)) return;
    const root = document.documentElement;
    root.classList.add("theme-fading");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-fading"), FADE_MS);
    root.dataset.theme = id;
    setThemeState(id);
    setNativeLight(readNativeLight());
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {}
  };

  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.mode !== "alt";
    // 전환하는 동안만 색 transition을 켜서 부드럽게 바뀌게 한다.
    root.classList.add("theme-fading");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-fading"), FADE_MS);
    setAlt(next);
    if (next) root.dataset.mode = "alt";
    else delete root.dataset.mode;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "alt" : "default");
    } catch {}
  };

  // 지금 화면이 밝은지(원래 밝은 테마이고 기본 모드, 또는 원래 어두운 테마이고 반대 모드)
  const looksLight = nativeLight !== alt;

  return { looksLight, toggle, theme, setTheme };
}

export default function ThemeToggle() {
  const { looksLight, toggle } = useThemeMode();
  const label = looksLight ? "다크 모드로 전환" : "화이트 모드로 전환";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      // 로비에서는 햄버거 메뉴 안에 같은 기능이 있어 떠 있는 버튼을 숨긴다.
      className="in-[.has-menu-theme]:hidden fixed bottom-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-[18px] opacity-80 transition hover:opacity-100"
    >
      {looksLight ? "🌙" : "☀️"}
    </button>
  );
}
