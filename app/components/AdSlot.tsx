"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  slotId: string;
  className?: string;
  // width/height를 주면 스카이스크래퍼·사각형 배너 같은 고정 크기
  // 광고 단위로 렌더링한다 — 이 경우 폭에 맞춰 늘어나는 반응형
  // 속성(data-ad-format 등)은 붙이지 않는다. 둘 다 생략하면 폭에 맞춰
  // 늘어나는 반응형 배너가 된다.
  width?: number;
  height?: number;
}

// 애드센스 광고 단위 하나. 클라이언트 ID가 없는 로컬/프리뷰 환경에서는
// 빈 자리조차 차지하지 않도록 아예 렌더링하지 않는다 — layout.tsx의
// adsbygoogle 스크립트도 같은 조건으로 로드 여부가 갈린다.
export function AdSlot({ slotId, className, width, height }: AdSlotProps) {
  const pushedRef = useRef(false);
  const isFixedSize = width !== undefined && height !== undefined;

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId || pushedRef.current) return;
    pushedRef.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 스크립트가 아직 없을 때는 조용히 무시한다.
    }
  }, [slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ""}`}
      style={
        isFixedSize
          ? { display: "inline-block", width, height }
          : { display: "block" }
      }
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slotId}
      {...(!isFixedSize
        ? { "data-ad-format": "auto", "data-full-width-responsive": "true" }
        : {})}
    />
  );
}
