"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useAuth } from "@/lib/useAuth";
import { PROFILES_COLLECTION, UserProfile } from "@/lib/profile";
import { RANKINGS_COLLECTION } from "@/lib/ranking";
import { GoogleSignInButton } from "@/app/components/GoogleSignInButton";

const MAX_NAME_LENGTH = 13;

export default function ProfilePage() {
  const user = useAuth();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError("");

        return getFirebaseDb();
      })
      .then(async (firestore) => {
        if (!firestore || cancelled) return;

        const { doc, getDoc } = await import("firebase/firestore");

        if (cancelled) return;

        const snapshot = await getDoc(
          doc(firestore, PROFILES_COLLECTION, user.uid),
        );

        if (cancelled) return;

        const profile = snapshot.data() as UserProfile | undefined;

        setName(
          profile?.name ?? user.displayName?.slice(0, MAX_NAME_LENGTH) ?? "",
        );
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("프로필을 불러오지 못했습니다:", err);
        setError("프로필을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveName = () => {
    if (!user) return;

    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);

    if (trimmed.length === 0) {
      setError("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    const profile: UserProfile = { name: trimmed, updatedAt: Date.now() };

    getFirebaseDb()
      .then(async (firestore) => {
        if (!firestore) return;

        const { doc, setDoc, updateDoc } = await import("firebase/firestore");

        await setDoc(doc(firestore, PROFILES_COLLECTION, user.uid), profile, {
          merge: true,
        });

        setName(trimmed);
        setSaved(true);

        // 이미 랭킹에 기록이 있는 계정이면 표시 이름도 바로 갱신한다.
        // 아직 한 판도 안 한 계정은 랭킹 문서가 없어서 실패하는데, 그건 정상이라 무시한다.
        updateDoc(doc(firestore, RANKINGS_COLLECTION, user.uid), {
          name: trimmed,
        }).catch(() => {});
      })
      .catch((err) => {
        console.error("프로필 저장에 실패했습니다:", err);
        setError("저장에 실패했습니다.");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-block text-[13.5px] text-zinc-500 hover:text-zinc-300"
        >
          ← 돌아가기
        </Link>

        <h1 className="mb-6 text-[28px] font-bold tracking-tight text-gold">
          내 프로필
        </h1>

        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <p className="mb-4 text-[15px] text-zinc-400">
              프로필을 설정하려면 먼저 로그인해주세요.
            </p>

            <GoogleSignInButton onError={setError} />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <p className="mb-4 text-[15px] text-zinc-400">
              {user.email}로 로그인됨
            </p>

            <label className="mb-1.5 block text-[13px] font-medium text-zinc-500">
              닉네임
            </label>

            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
              placeholder="닉네임을 입력하세요"
              maxLength={MAX_NAME_LENGTH}
              disabled={loading}
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20 disabled:opacity-50"
            />

            <p className="mb-4 text-[13px] text-zinc-500">
              여기서 설정한 닉네임은 방 참가 시 이름을 따로 입력하지 않으면
              기본값으로 쓰이고, 랭킹에도 이 이름으로 표시돼요.
            </p>

            <button
              type="button"
              onClick={saveName}
              disabled={saving || loading}
              className="w-full rounded-xl bg-gold px-6 py-3 text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? "저장 중..." : "저장"}
            </button>

            {saved && (
              <p className="mt-3 text-center text-[13.5px] text-felt-bright">
                저장됐어요.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-center text-[15px] font-medium text-crimson-bright">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
