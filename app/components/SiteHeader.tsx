"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { HamburgerMenu } from "./HamburgerMenu";

export function SiteHeader({
  settings,
  onOpenProfile,
  balance,
  displayName,
}: {
  balance?: number | null;
  displayName?: string | null;
  settings?: ReactNode;
  onOpenProfile?: () => void;
}) {
  const pathname = usePathname();
  const user = useAuth();
  const links = [
    ["/", "플레이"],
    ["/rules", "족보와 규칙"],
    ["/guide", "가이드"],
    ["/ranking", "랭킹"],
  ];
  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="섯다 홈">
        <span aria-hidden="true">花</span>섯다
      </Link>
      <nav aria-label="주요 메뉴" className="site-nav">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href || (href === "/" && pathname === "/rooms")
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="site-account">
        {user && balance != null && (
          <span className="account-balance">{balance.toLocaleString()}칩</span>
        )}
        {user && onOpenProfile ? (
          <button onClick={onOpenProfile}>
            {displayName || user.displayName || "프로필"}
          </button>
        ) : (
          <Link href={user ? "/" : "/login"}>
            {user ? "내 계정" : "로그인"}
          </Link>
        )}
        <HamburgerMenu
          userName={displayName ?? user?.displayName ?? null}
          onOpenProfile={onOpenProfile}
          settings={settings}
        />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="사이트 정보">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/about">소개 · 문의</Link>
      </nav>
      <span>© {new Date().getFullYear()} 섯다</span>
    </footer>
  );
}
