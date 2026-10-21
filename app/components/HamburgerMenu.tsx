"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { THEMES } from "@/lib/themes";
import { useThemeMode } from "./ThemeToggle";

interface HamburgerMenuProps {
  // 로그인한 사용자의 표시 이름. 로그인하지 않았으면 null.
  userName: string | null;
  // 없으면 프로필이 있는 로비("/")로 이동하는 링크가 된다.
  onOpenProfile?: () => void;
  // 설정 항목들 — 햄버거 버튼 바로 아래 뷰포트에 펼쳐진다. 없으면 설정 항목을 숨긴다.
  settings?: ReactNode;
  // 로비가 아닌 페이지에서 "홈" 항목을 보여 줄지
  showHome?: boolean;
}

const ITEM_CLASS =
  "flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[15.5px] font-semibold text-zinc-100 transition hover:bg-zinc-800";

// Shared account, settings and three-theme menu.
export function HamburgerMenu({
  userName,
  onOpenProfile,
  settings,
  showHome = false,
}: HamburgerMenuProps) {
  const [view, setView] = useState<"closed" | "menu" | "settings" | "themes">(
    "closed",
  );
  const open = view !== "closed";
  const setOpen = (next: boolean) => setView(next ? "menu" : "closed");
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useThemeMode();
  const themeLabel = THEMES.find((item) => item.id === theme)?.label ?? "";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setView(open ? "closed" : "menu")}
        aria-label="메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-zinc-100 transition hover:bg-zinc-800"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M4 4l10 10M14 4L4 14" />
          ) : (
            <path d="M3 5h12M3 9h12M3 13h12" />
          )}
        </svg>
      </button>

      <div
        role="menu"
        aria-label="메뉴"
        inert={view !== "menu"}
        className={`absolute right-0 top-12 z-30 w-56 origin-top-right rounded-2xl border border-hairline bg-zinc-900 p-1.5 transition duration-150 ${
          view === "menu"
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {showHome && (
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM_CLASS}
          >
            홈
          </Link>
        )}

        {userName && onOpenProfile ? (
          <button
            type="button"
            role="menuitem"
            onClick={run(onOpenProfile)}
            className={ITEM_CLASS}
          >
            <span className="min-w-0 truncate">{userName}님</span>
            <span className="shrink-0 text-[13px] font-medium text-zinc-500">
              프로필
            </span>
          </button>
        ) : userName ? (
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM_CLASS}
          >
            <span className="min-w-0 truncate">{userName}님</span>
            <span className="shrink-0 text-[13px] font-medium text-zinc-500">
              프로필
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM_CLASS}
          >
            로그인
          </Link>
        )}

        <div className="mobile-nav-links">
          <Link href="/guide" role="menuitem" onClick={() => setOpen(false)} className={ITEM_CLASS}>가이드</Link>
          <Link href="/ranking" role="menuitem" onClick={() => setOpen(false)} className={ITEM_CLASS}>랭킹</Link>
        </div>

        {settings && (
          <button
            type="button"
            role="menuitem"
            onClick={() => setView("settings")}
            className={ITEM_CLASS}
          >
            <span>설정</span>
            <span aria-hidden="true" className="text-[13px] text-zinc-500">
              ›
            </span>
          </button>
        )}

        <div className="mx-2 my-1 border-t border-hairline" />

        <button
          type="button"
          role="menuitem"
          onClick={() => setView("themes")}
          className={ITEM_CLASS}
        >
          <span>테마</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-zinc-500">
            <span className="truncate">{themeLabel}</span>
            <span aria-hidden="true">›</span>
          </span>
        </button>

      </div>

      {/* 설정 뷰포트 — 햄버거 버튼 바로 아래에 펼쳐진다. */}
      {settings && (
        <section
          aria-label="설정"
          inert={view !== "settings"}
          className={`absolute right-0 top-12 z-30 flex max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-2rem))] origin-top-right flex-col rounded-2xl border border-hairline bg-zinc-900 transition duration-150 ${
            view === "settings"
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center gap-1 border-b border-hairline px-2 py-2">
            <button
              type="button"
              onClick={() => setView("menu")}
              aria-label="메뉴로 돌아가기"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-black"
            >
              ‹
            </button>
            <h3 className="text-[17px] font-bold">설정</h3>
          </div>

          <div className="overflow-y-auto px-4 py-3">{settings}</div>
        </section>
      )}

      {/* 테마 뷰포트 — 테마를 고르면 바로 적용된다. */}
      <section
        aria-label="테마"
        inert={view !== "themes"}
        className={`absolute right-0 top-12 z-30 flex max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-2rem))] origin-top-right flex-col rounded-2xl border border-hairline bg-zinc-900 transition duration-150 ${
          view === "themes"
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-1 border-b border-hairline px-2 py-2">
          <button
            type="button"
            onClick={() => setView("menu")}
            aria-label="메뉴로 돌아가기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-black"
          >
            ‹
          </button>
          <h3 className="text-[17px] font-bold">테마</h3>
        </div>

        <ul aria-label="테마" className="overflow-y-auto p-1.5">
          {THEMES.map((item) => {
            const selected = item.id === theme;

            return (
              <li key={item.id}>
                <label
                  className={`flex min-h-18 w-full items-center gap-3 rounded-xl px-3 cursor-pointer text-left text-[15px] font-semibold transition focus-within:ring-2 focus-within:ring-gold hover:bg-zinc-800 ${
                    selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-200"
                  }`}
                >
                  <input type="radio" name="site-theme" value={item.id} checked={selected} onChange={() => setTheme(item.id)} className="sr-only" />
                  <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                    {item.swatch.map((color, index) => (
                      <span
                        key={index}
                        className="h-4 w-4 rounded-full border border-black/20"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block">{item.label}</span><span className="mt-1 block text-xs font-normal text-zinc-400">{item.description}</span></span>
                  {selected && <span aria-hidden="true">✓</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
