"use client";

import { useEffect, useState } from "react";

// 640px는 Tailwind의 sm 브레이크포인트와 같다 — 그 이상에서는 채팅을 항상
// 열려 있는 도킹 패널로 붙박아 보여주고, 그 아래(모바일)에서만 버튼으로
// 여닫는 오버레이로 동작한다.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 640px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    query.addEventListener("change", handleChange);

    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}
