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

export function ShareButtons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
            className="rounded-lg bg-[#FEE500] px-3 py-1.5 text-[13px] font-semibold text-black/85 transition hover:brightness-95 active:scale-95"
          >
            카카오톡 공유
          </button>
        </>
      )}

      <a
        href={TWITTER_SHARE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-white/15 bg-white/3 px-3 py-1.5 text-[13px] font-semibold text-zinc-200 transition hover:bg-white/10"
      >
        X(트위터) 공유
      </a>
    </div>
  );
}
