"use client";

import { useEffect, useRef } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/messages";

// Google Identity Services가 발급한 ID 토큰을 우리 서버(/api/auth/google)로
// 보내, 내부 계정의 파이어베이스 커스텀 토큰으로 바꿔 로그인한다.
// signInWithRedirect/Popup과 달리 authDomain을 거치는 중계가 없어 서드파티
// 스토리지 차단의 영향을 받지 않는다.
//
// mode="link"이면 로그인 대신 "지금 로그인한 계정에 구글을 연결"한다.
//
// 스크립트 자체는 app/layout.tsx에서 앱 전체에 한 번만 로드된다 — 이 컴포넌트는
// 로그인/로그아웃으로 마운트·언마운트를 반복하므로, 로그아웃 후 이 컴포넌트가
// 다시 나타날 때는 스크립트가 이미 준비돼 있을 수도, 아직일 수도 있다. 그래서
// 로드 콜백에 기대지 않고 window.google이 준비될 때까지 짧게 폴링한다.
export function GoogleSignInButton({
  onError,
  onLinked,
  mode = "login",
  width,
}: {
  onError?: (message: string) => void;
  onLinked?: () => void;
  mode?: "login" | "link";
  width?: number;
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null);

  // 콜백이 바뀔 때마다 구글 버튼을 다시 그리지 않도록 ref로 들고 있는다.
  const onErrorRef = useRef(onError);
  const onLinkedRef = useRef(onLinked);

  useEffect(() => {
    onErrorRef.current = onError;
    onLinkedRef.current = onLinked;
  });

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    getFirebaseAuth().then(async (auth) => {
      if (!auth || cancelled) return;

      const handleCredential = async (credential: string) => {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (mode === "link") {
            const idToken = await auth.currentUser?.getIdToken();

            if (!idToken) throw new Error("not signed in");

            headers.Authorization = `Bearer ${idToken}`;
          }

          const response = await fetch("/api/auth/google", {
            method: "POST",
            headers,
            body: JSON.stringify({ credential }),
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            onErrorRef.current?.(authErrorMessage(data.error));
            return;
          }

          if (mode === "link") {
            onLinkedRef.current?.();
            return;
          }

          // firebase/auth는 실제로 로그인할 때만 불러온다.
          const { signInWithCustomToken } = await import("firebase/auth");

          await signInWithCustomToken(auth, data.token);
        } catch (err) {
          console.error("로그인 실패:", err);
          onErrorRef.current?.(authErrorMessage("failed"));
        }
      };

      const render = () => {
        if (cancelled || !buttonRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            void handleCredential(response.credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          size: "large",
          text: mode === "link" ? "continue_with" : "signin",
          width,
        });
      };

      if (window.google) {
        render();
      } else {
        interval = setInterval(() => {
          if (window.google) {
            clearInterval(interval);
            render();
          }
        }, 100);
      }
    });

    return () => {
      cancelled = true;

      if (interval) clearInterval(interval);
    };
  }, [mode, width]);

  return <div ref={buttonRef} />;
}
