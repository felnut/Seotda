import type { Metadata } from "next";
import Script from "next/script";
import ThemeToggle from "./components/ThemeToggle";
import { MODE_STORAGE_KEY } from "@/lib/themes";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const THEME_INIT_SCRIPT = `(function(){try{document.documentElement.dataset.mode=localStorage.getItem("${MODE_STORAGE_KEY}")==="alt"?"alt":"default"}catch(e){}})();`;

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

const SITE_URL = "https://seotda.felnut.com";
const SITE_NAME = "섯다";
const SITE_TITLE = "섯다 - 친구와 온라인으로 즐기는 전통 카드 게임";
const SITE_DESCRIPTION =
  "친구와 온라인에서 실시간으로 즐기는 전통 섯다 카드 게임. 닉네임만 입력하면 바로 참가할 수 있고, 2~6명이 함께 방을 만들어 무료로 대결합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  other: {
    "google-adsense-account": "ca-pub-7832449160876742",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* 저장된 테마·모드를 첫 페인트 전에 적용해 기본 테마가 번쩍이지 않게 한다. */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeToggle />
        {process.env.VERCEL === "1" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
        {/* 로그인/로그아웃으로 버튼이 다시 마운트돼도 다시 로드하지 않도록 앱
            전체에서 한 번만 불러온다. */}
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
          />
        )}
        {/* 클라이언트 ID가 없는 로컬/프리뷰 환경에서는 애드센스 스크립트
            자체를 건너뛴다 — AdSlot도 같은 값으로 렌더 여부를 판단한다.
            beforeInteractive는 애드센스 검토 크롤러가 raw HTML에서 바로
            스크립트를 찾을 수 있게 해주지만, 실제 사용자에게는 하이드레이션을
            막아 모바일 LCP/TTI를 늦춘다. 애드센스 크롤러는 자바스크립트를
            실행한다고 알려져 있어 afterInteractive로도 승인엔 지장이
            없을 것으로 보고, 실사용자 성능을 우선해 되돌린다. */}
        {ADSENSE_CLIENT_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
