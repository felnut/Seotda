"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Script from "next/script";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/messages";

// Google Identity Services의 토큰 팝업으로 액세스 토큰을 받아 우리 서버
// (/api/auth/google)로 보내, 내부 계정의 파이어베이스 커스텀 토큰으로 바꿔
// 로그인한다. 구글이 그려주는 공식 버튼 대신 우리 버튼을 쓸 수 있어서 다른
// 로그인 버튼과 모양을 맞출 수 있고, signInWithRedirect/Popup과 달리
// authDomain을 거치는 중계가 없어 서드파티 스토리지 차단의 영향도 받지 않는다.
//
// mode="link"이면 로그인 대신 "지금 로그인한 계정에 구글을 연결"한다.
//
// 로그인 버튼이 필요할 때만 SDK를 로드한다. next/script가 중복 로드를 막고,
// onReady는 이미 로드된 SDK로 버튼을 다시 마운트한 경우에도 호출된다.
export function GoogleSignInButton({
  onError,
  onLinked,
  mode = "login",
  className,
  children,
}: {
  onError?: (message: string) => void;
  onLinked?: () => void;
  mode?: "login" | "link";
  className?: string;
  children: ReactNode;
}) {
  const clientRef = useRef<GoogleTokenClient | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  // 콜백이 바뀔 때마다 토큰 클라이언트를 다시 만들지 않도록 ref로 들고 있는다.
  const onErrorRef = useRef(onError);
  const onLinkedRef = useRef(onLinked);

  useEffect(() => {
    onErrorRef.current = onError;
    onLinkedRef.current = onLinked;
  });

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId || !sdkReady) return;

    let cancelled = false;

    const handleToken = async (accessToken: string) => {
      try {
        const auth = await getFirebaseAuth();

        if (!auth) throw new Error("firebase not configured");

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
          body: JSON.stringify({ accessToken }),
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
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    const setup = () => {
      if (cancelled || !window.google) return;

      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (response) => {
          if (response.access_token) {
            void handleToken(response.access_token);
          } else {
            // 사용자가 팝업을 닫았거나 권한을 거부한 경우
            setBusy(false);
          }
        },
        error_callback: () => setBusy(false),
      });

      setReady(true);
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [mode, sdkReady]);

  return (
    <>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setSdkReady(true)}
          onLoad={() => setSdkReady(true)}
          onError={() => onErrorRef.current?.("Google 로그인을 불러오지 못했어요. 잠시 후 다시 시도해주세요.")}
        />
      )}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => {
          setBusy(true);
          // 팝업 차단을 피하려면 클릭 처리 안에서 바로 호출해야 한다.
          clientRef.current?.requestAccessToken({ prompt: "select_account" });
        }}
        className={className}
      >
        {children}
      </button>
    </>
  );
}
