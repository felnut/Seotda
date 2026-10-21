"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { HamburgerMenu } from "./HamburgerMenu";

export function SiteMenu() {
  const user = useAuth();
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="섯다 홈"><span className="brand-mark" aria-hidden="true">花</span> 섯다</Link>
      <nav aria-label="주요 메뉴"><Link href="/rooms">방 찾기</Link><Link href="/rules">족보와 규칙</Link><Link href="/guide">가이드</Link></nav>
      <HamburgerMenu userName={user ? (user.displayName ?? "플레이어") : null} showHome />
    </header>
  );
}
