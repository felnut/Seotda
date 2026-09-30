"use client";

import { useCallback, useEffect, useState } from "react";
import type { LoginProvider } from "@/lib/auth/accounts";
import {
  fetchLinkedProviders,
  startLoginLink,
  unlinkLoginProvider,
  type LinkedProviders,
} from "@/lib/auth/linkClient";
import { GoogleSignInButton } from "./GoogleSignInButton";

const PROVIDER_LABELS: Record<LoginProvider, string> = {
  google: "Google",
  github: "GitHub",
  naver: "네이버",
  kakao: "카카오",
};

const ORDER: LoginProvider[] = ["google", "github", "naver", "kakao"];

export interface LinkNotice {
  text: string;
  error: boolean;
}

// 설정 패널의 "연결된 로그인" — 한 계정에 구글·깃허브·네이버·카카오를 최대
// 4개까지 연결해두면, 어느 방식으로 로그인해도 같은 칩과 전적이 이어진다.
export function LinkedAccounts({
  active,
  notice,
}: {
  active: boolean;
  notice: LinkNotice | null;
}) {
  const [linked, setLinked] = useState<LinkedProviders | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<LinkNotice | null>(null);

  const refresh = useCallback(() => {
    fetchLinkedProviders()
      .then(setLinked)
      .catch((err) => {
        console.error("연결된 로그인을 불러오지 못했습니다:", err);
      });
  }, []);

  // 패널이 열릴 때마다(그리고 연결 후 돌아왔을 때) 최신 상태를 다시 읽는다.
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const shown = message ?? notice;
  const linkedCount = linked ? ORDER.filter((p) => linked[p]).length : 0;

  const link = async (provider: "github" | "naver" | "kakao") => {
    setBusy(true);
    setMessage(null);

    try {
      await startLoginLink(provider);
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
      setBusy(false);
    }
  };

  const unlink = async (provider: LoginProvider) => {
    if (
      !window.confirm(
        `${PROVIDER_LABELS[provider]} 로그인 연결을 해제할까요? 해제해도 계정과 칩은 그대로예요.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      setLinked(await unlinkLoginProvider(provider));
      setMessage({ text: "연결을 해제했어요.", error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h4 className="mb-1 text-[15px] font-semibold text-zinc-200">
        연결된 로그인
      </h4>

      <p className="mb-3 text-[13px] text-zinc-500">
        여러 방식을 연결해두면 어느 쪽으로 로그인해도 같은 칩과 기록이
        이어져요. (최대 4개)
      </p>

      <ul className="flex flex-col gap-2">
        {ORDER.map((provider) => {
          const isLinked = !!linked?.[provider];

          return (
            <li
              key={provider}
              className="rounded-xl border border-white/10 bg-white/3 px-4 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-zinc-200">
                  {PROVIDER_LABELS[provider]}
                </span>

                {linked === null ? (
                  <span className="text-[13px] text-zinc-500">...</span>
                ) : isLinked ? (
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] text-felt-bright">
                      연결됨
                    </span>

                    {linkedCount > 1 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => unlink(provider)}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-[12.5px] text-zinc-300 transition hover:border-crimson/40 hover:text-crimson-bright disabled:opacity-50"
                      >
                        해제
                      </button>
                    )}
                  </span>
                ) : provider === "google" ? (
                  <span className="text-[13px] text-zinc-500">
                    아래 버튼으로 연결
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => link(provider)}
                    className="rounded-lg bg-gold px-3 py-1 text-[13px] font-semibold text-zinc-900 transition hover:bg-gold-bright disabled:opacity-50"
                  >
                    연결하기
                  </button>
                )}
              </div>

              {provider === "google" && linked && !isLinked && (
                <div className="mt-2">
                  <GoogleSignInButton
                    mode="link"
                    width={280}
                    onLinked={() => {
                      setMessage({ text: "Google을 연결했어요.", error: false });
                      refresh();
                    }}
                    onError={(text) => setMessage({ text, error: true })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {shown && (
        <p
          className={`mt-2 text-center text-[13.5px] ${
            shown.error ? "text-crimson-bright" : "text-felt-bright"
          }`}
        >
          {shown.text}
        </p>
      )}
    </div>
  );
}
