"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Google Identity Services가 발급한 ID 토큰을 Firebase 자격 증명으로 바꿔 로그인한다.
// signInWithRedirect/Popup과 달리 authDomain을 거치는 중계가 없어 서드파티
// 스토리지 차단의 영향을 받지 않는다.
export function GoogleSignInButton({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const [isGsiReady, setIsGsiReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!auth || !buttonRef.current || !isGsiReady) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) return;

    window.google?.accounts.id.initialize({
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

    window.google?.accounts.id.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "medium",
      text: "signin",
    });
  }, [isGsiReady, onError]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setIsGsiReady(true)}
      />

      <div ref={buttonRef} />
    </>
  );
}
