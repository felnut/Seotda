import Link from "next/link";

export function SiteLinks() {
  return (
    <nav className="header-links" aria-label="주요 메뉴">
      <Link href="/rooms">방 찾기</Link>
      <Link href="/rules">족보와 규칙</Link>
      <Link href="/guide">가이드</Link>
      <Link href="/ranking">랭킹</Link>
    </nav>
  );
}
