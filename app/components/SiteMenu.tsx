"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { SiteLinks } from "./SiteLinks";
import { HamburgerMenu } from "./HamburgerMenu";

export function SiteMenu() {
  const user = useAuth();
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="섯다 홈"><span className="brand-mark" aria-hidden="true">花</span> 섯다</Link>
      <SiteLinks />
      <HamburgerMenu userName={user ? (user.displayName ?? "플레이어") : null} showHome />
    </header>
  );
}
