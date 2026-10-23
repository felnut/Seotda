"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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

// 로비 우측 상단 햄버거 메뉴 — 로그인(프로필), 랭킹, 설정, 다크/화이트 전환을 한곳에 모은다.
export function HamburgerMenu({
  userName,
  onOpenProfile,
  settings,
  showHome = false,
}: HamburgerMenuProps) {
  const [view, setView] = useState<"closed" | "menu" | "settings">("closed");
  const open = view !== "closed";
  const setOpen = (next: boolean) => setView(next ? "menu" : "closed");
  const rootRef = useRef<HTMLDivElement>(null);
  const { looksLight, toggle } = useThemeMode();

  // 메뉴에 테마 전환이 있으므로 떠 있는 전환 버튼은 숨긴다(ThemeToggle 참고).
  useEffect(() => {
    document.documentElement.classList.add("has-menu-theme");
    return () => document.documentElement.classList.remove("has-menu-theme");
  }, []);

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
        aria-label="설정 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-zinc-100 transition hover:bg-zinc-800"
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1Z" />
          <circle cx="11" cy="11" r="3" />
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

        <Link
          href="/ranking"
          role="menuitem"
          onClick={() => setOpen(false)}
          className={ITEM_CLASS}
        >
          랭킹
        </Link>

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
          onClick={toggle}
          className={ITEM_CLASS}
        >
          <span>{looksLight ? "다크 모드" : "라이트 모드"}</span>
          <span aria-hidden="true" className="text-[17px]">
            {looksLight ? "🌙" : "☀️"}
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
    </div>
  );
}
