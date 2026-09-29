"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";

// 네이버/카카오 로그인의 마지막 단계 — 서버가 URL 해시(#token=...)로 넘겨준
// 파이어베이스 커스텀 토큰으로 이 브라우저를 로그인시킨다.
export default function LoginCompletePage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );

    // 토큰이 주소창·히스토리에 남지 않도록 바로 지운다.
    window.history.replaceState(null, "", window.location.pathname);

    const finish = async () => {
      const auth = await getFirebaseAuth();

      if (!token || !auth) throw new Error("no token");

      const { signInWithCustomToken } = await import("firebase/auth");

      await signInWithCustomToken(auth, token);
      router.replace("/");
    };

    finish().catch((err) => {
      console.error("로그인 완료 실패:", err);
      setFailed(true);
    });
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-zinc-200">
      {failed ? (
        <>
          <p>로그인에 실패했어요.</p>
          <Link
            href="/login"
            className="text-gold-bright underline underline-offset-2"
          >
            다시 시도하기
          </Link>
        </>
      ) : (
        <p>로그인하는 중...</p>
      )}
    </main>
  );
}
