import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

// 심플하고 모던한 톤을 위해 본문·제목 모두 하나의 고딕체(굵기로만 위계를
// 준다) + 칩/판돈 숫자용 모노스페이스로 타이포그래피를 구성한다.
const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-noto-sans-kr",
});

const plexMono = IBM_Plex_Mono({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "섯다",
  description: "친구와 온라인으로 즐기는 전통 섯다 카드 게임",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Analytics />
        {/* 로그인/로그아웃으로 버튼이 다시 마운트돼도 다시 로드하지 않도록 앱
            전체에서 한 번만 불러온다. */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
