import type { Metadata } from "next";
import { IBM_Plex_Mono, Nanum_Myeongjo, Noto_Sans_KR } from "next/font/google";
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

// "섯다" 로고·브랜드 타이틀 전용 포인트 서체 — 본문은 계속 고딕으로 두고,
// 이 서체 하나만 골라 써서 전통 화투/도박판 느낌을 살짝 얹는다.
const nanumMyeongjo = Nanum_Myeongjo({
  weight: ["700", "800"],
  subsets: ["latin"],
  variable: "--font-nanum-myeongjo",
});

const SITE_URL = "https://seotda.felnut.com";
const SITE_TITLE = "섯다";
const SITE_DESCRIPTION = "친구와 온라인으로 즐기는 전통 섯다 카드 게임";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${plexMono.variable} ${nanumMyeongjo.variable} h-full antialiased`}
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
