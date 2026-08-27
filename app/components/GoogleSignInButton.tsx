"use client";

import { useEffect, useRef } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Google Identity Services가 발급한 ID 토큰을 Firebase 자격 증명으로 바꿔 로그인한다.
// signInWithRedirect/Popup과 달리 authDomain을 거치는 중계가 없어 서드파티
// 스토리지 차단의 영향을 받지 않는다.
//
// 스크립트 자체는 app/layout.tsx에서 앱 전체에 한 번만 로드된다 — 이 컴포넌트는
// 로그인/로그아웃으로 마운트·언마운트를 반복하므로, 로그아웃 후 이 컴포넌트가
// 다시 나타날 때는 스크립트가 이미 준비돼 있을 수도, 아직일 수도 있다. 그래서
// 로드 콜백에 기대지 않고 window.google이 준비될 때까지 짧게 폴링한다.
export function GoogleSignInButton({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!auth) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !buttonRef.current || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!auth) return;

          const credential = GoogleAuthProvider.credential(response.credential);

          signInWithCredential(auth, credential).catch((err) => {
            console.error("로그인 실패:", err);
            onError?.("로그인에 실패했습니다.");
          });
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "medium",
        text: "signin",
      });
    };

    if (window.google) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          render();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [onError]);

  return <div ref={buttonRef} />;
}
