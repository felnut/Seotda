"use client";

import Script from "next/script";

const SITE_URL = "https://seotda.felnut.com";
const SHARE_TITLE = "섯다 - 친구와 온라인으로 즐기는 전통 카드 게임";
const SHARE_DESCRIPTION = "친구와 온라인으로 즐기는 전통 섯다 카드 게임";
const SHARE_IMAGE_URL = `${SITE_URL}/opengraph-image`;

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

// 카카오 디벨로퍼스(https://developers.kakao.com/docs/ko/javascript/download)의
// "최신 버전" 표에 있는 정확한 버전·integrity 값을 그대로 사용한다 — 값이
// 하나라도 틀리면 SRI 검증에 걸려 스크립트 자체가 조용히 실행되지 않는다.
const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";

function shareToKakao() {
  const kakao = window.Kakao;

  if (!kakao || !KAKAO_JS_KEY) return;

  if (!kakao.isInitialized()) {
    kakao.init(KAKAO_JS_KEY);
  }

  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      imageUrl: SHARE_IMAGE_URL,
      link: { mobileWebUrl: SITE_URL, webUrl: SITE_URL },
    },
    buttons: [
      {
        title: "게임 하러 가기",
        link: { mobileWebUrl: SITE_URL, webUrl: SITE_URL },
      },
    ],
  });
}

const TWITTER_SHARE_URL = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
  SITE_URL,
)}&text=${encodeURIComponent(SHARE_TITLE)}`;

function KakaoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.86 5.24 4.66 6.65-.15.55-.96 3.44-.99 3.66 0 0-.02.17.09.24.11.07.24.02.24.02.32-.04 3.71-2.43 4.29-2.84.55.08 1.12.13 1.71.13 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// 메인 화면 좌측 하단에 아이콘만 남겨두는 동그란 공유 버튼 — 텍스트 라벨
// 없이 아이콘 하나로만 카카오톡/X 공유를 제공한다.
export function ShareButtons() {
  return (
    <div className="flex flex-col gap-2">
      {KAKAO_JS_KEY && (
        <>
          <Script
            src={KAKAO_SDK_SRC}
            integrity={KAKAO_SDK_INTEGRITY}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />

          <button
            type="button"
            onClick={shareToKakao}
            aria-label="카카오톡으로 공유"
            title="카카오톡으로 공유"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[#FEE500] text-black/80 shadow-lg shadow-black/40 transition hover:brightness-95 active:scale-95"
          >
            <KakaoIcon />
          </button>
        </>
      )}

      <a
        href={TWITTER_SHARE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X(트위터)로 공유"
        title="X(트위터)로 공유"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900 text-zinc-100 shadow-lg shadow-black/40 transition hover:bg-zinc-800"
      >
        <XIcon />
      </a>
    </div>
  );
}
