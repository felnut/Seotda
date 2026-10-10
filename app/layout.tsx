import type { Metadata } from "next";
import {
  DM_Sans,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  Nanum_Myeongjo,
  Saira_Condensed,
} from "next/font/google";
import Script from "next/script";
import ThemeToggle from "./components/ThemeToggle";
import { DEFAULT_THEME, MODE_STORAGE_KEY, THEME_STORAGE_KEY, THEMES } from "@/lib/themes";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// 테마마다 쓰는 서체가 달라 한꺼번에 등록해 둔다. 기본 테마가 쓰는 서체만
// 미리 불러오고(preload), 나머지는 해당 테마를 고를 때 비로소 내려받는다.
// 서체 이름은 app/themes.css 의 --tf-* 변수가 고른다.
const iBMPlexMono = IBM_Plex_Mono({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
});

const sairaCondensed = Saira_Condensed({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-saira",
  preload: false,
});

const nanumMyeongjo = Nanum_Myeongjo({
  weight: ["700", "800"],
  subsets: ["latin"],
  variable: "--font-nanum-myeongjo",
  preload: false,
});

const hankenGrotesk = Hanken_Grotesk({
  weight: ["700", "800"],
  subsets: ["latin"],
  variable: "--font-hanken",
  preload: false,
});

const iBMPlexSans = IBM_Plex_Sans({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
  preload: false,
});

const dMSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  preload: false,
});

const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,ids=${JSON.stringify(THEMES.map((t) => t.id))},t=localStorage.getItem("${THEME_STORAGE_KEY}");d.dataset.theme=ids.indexOf(t)>=0?t:"${DEFAULT_THEME}";if(localStorage.getItem("${MODE_STORAGE_KEY}")==="alt")d.dataset.mode="alt"}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}"}})();`;

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
  other: {
    "google-adsense-account": "ca-pub-7832449160876742",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${[iBMPlexMono.variable, inter.variable, sairaCondensed.variable, nanumMyeongjo.variable, hankenGrotesk.variable, iBMPlexSans.variable, dMSans.variable].join(" ")} h-full antialiased`}
    >
      <head>
        {/* 한국어를 지원하지 않는 서체(Inter 등)의 한글 글자는 Pretendard로 대신 보여 준다.
            글자 조각(unicode-range)별로 쪼개져 있어 화면에 쓰인 글자만 내려받는다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 저장된 테마·모드를 첫 페인트 전에 적용해 기본 테마가 번쩍이지 않게 한다. */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeToggle />
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
