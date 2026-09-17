import type { Metadata } from "next";
import { IBM_Plex_Mono, Nanum_Myeongjo, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

const SITE_URL = "https://seotda.felnut.com";
const SITE_NAME = "섯다";
// 검색 결과에 노출되는 title/H1은 "섯다" 한 단어만으로는 너무 짧고
// 무엇에 대한 페이지인지 알 수 없다는 SEO 체크 결과에 따라, 브랜드명 뒤에
// 설명을 덧붙인 전체 타이틀을 별도로 둔다.
const SITE_TITLE = "섯다 - 친구와 온라인으로 즐기는 전통 카드 게임";
// 예전 설명("Socket.IO 기반 실시간 대전과...")은 검색 의도와 안 맞는다고
// 판단했는지 구글이 무시하고 로비 화면의 UI 문구(닉네임/방 만들기/인원 수)를
// 직접 긁어 스니펫으로 썼다. 그 정보를 설명 문장에 자연스럽게 녹여
// 구글이 우리 설명을 그대로 채택하도록 유도한다.
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${plexMono.variable} ${nanumMyeongjo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Analytics />
        <SpeedInsights />
        {/* 로그인/로그아웃으로 버튼이 다시 마운트돼도 다시 로드하지 않도록 앱
            전체에서 한 번만 불러온다. */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
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
