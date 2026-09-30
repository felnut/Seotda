"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/messages";
import { useAuth } from "@/lib/useAuth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

const BUTTON_CLASS =
  "relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 text-[16px] font-semibold text-zinc-100 transition hover:bg-white/10 active:scale-[0.98]";

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#03C75A" aria-hidden>
      <path d="M16.27 12.85 7.38 0H0v24h7.73V11.15L16.62 24H24V0h-7.73z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#FEE500" aria-hidden>
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.86 5.24 4.66 6.65-.15.55-.96 3.44-.99 3.66 0 0-.02.17.09.24.11.07.24.02.24.02.32-.04 3.71-2.43 4.29-2.84.55.08 1.12.13 1.71.13 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}

export function LoginClient({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const user = useAuth();
  const [error, setError] = useState(
    initialError ? authErrorMessage(initialError) : "",
  );

  // 어떤 방식으로든 로그인이 끝나면(이미 로그인된 상태로 들어온 경우 포함)
  // 로비로 돌아간다.
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-block text-[13.5px] text-zinc-400 hover:text-zinc-100"
        >
          ← 메인으로
        </Link>

        <h1 className="mb-2 font-serif text-[32px] font-black tracking-tight text-gold">
          로그인
        </h1>

        <p className="mb-6 text-[14.5px] leading-relaxed text-zinc-300">
          로그인하면 칩과 랭킹 기록이 계정에 저장돼요. 로그인 없이도 게스트로
          바로 플레이할 수 있어요.
        </p>

        <section className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-zinc-900/70 p-5 shadow-xl shadow-black/30">
          {/* 구글 버튼은 구글이 직접 그리는 공식 버튼을 그대로 보여준다. 투명하게
              덮어쓰면 구글이 클릭 도용 방지를 위해 클릭을 무시한다. */}
          <div className="min-h-11 w-full">
            <GoogleSignInButton onError={setError} />
          </div>

          <a href="/api/auth/github/start" className={BUTTON_CLASS}>
            <GithubIcon />
            GitHub로 계속하기
          </a>

          <a href="/api/auth/naver/start" className={BUTTON_CLASS}>
            <NaverIcon />
            네이버로 계속하기
          </a>

          <a href="/api/auth/kakao/start" className={BUTTON_CLASS}>
            <KakaoIcon />
            카카오로 계속하기
          </a>
        </section>

        {error && (
          <p className="animate-fade-up mt-4 rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-center text-[15px] font-medium text-crimson-bright">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
