"use client";

import { useAuth } from "@/lib/useAuth";
import { HamburgerMenu } from "./HamburgerMenu";

// 로비가 아닌 안내·가이드·랭킹 같은 페이지 우측 상단의 햄버거 메뉴.
// 부모(레이아웃)가 relative 여야 한다.
export function SiteMenu() {
  const user = useAuth();

  return (
    <div className="absolute top-4 right-4 z-30 sm:right-6">
      <HamburgerMenu
        userName={user ? (user.displayName ?? "플레이어") : null}
        showHome
      />
    </div>
  );
}
