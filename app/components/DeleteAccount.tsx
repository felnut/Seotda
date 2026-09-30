"use client";

import { useState } from "react";
import { deleteMyAccount } from "@/lib/auth/linkClient";

const CONFIRM_WORD = "탈퇴";

// 설정 패널의 회원 탈퇴 — 실수로 누르지 않도록 경고를 보여주고 확인 단어를
// 직접 입력해야 진행된다. 탈퇴하면 계정과 칩·랭킹 기록이 모두 사라진다.
export function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirmDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      await deleteMyAccount();
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full py-2 text-[13.5px] text-zinc-500 underline underline-offset-2 transition hover:text-crimson-bright"
      >
        회원 탈퇴
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-crimson/30 bg-crimson/10 p-4">
      <h4 className="mb-2 text-[15px] font-semibold text-crimson-bright">
        회원 탈퇴
      </h4>

      <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-zinc-300">
        <li>계정과 연결된 모든 로그인 정보가 삭제돼요.</li>
        <li>닉네임, 보유 칩, 랭킹과 전적이 모두 사라져요.</li>
        <li>삭제한 정보는 되돌릴 수 없어요.</li>
        <li>같은 방식으로 다시 로그인하면 새 계정으로 시작해요.</li>
      </ul>

      <label className="mb-1.5 block text-[13px] text-zinc-400">
        계속하려면 &quot;{CONFIRM_WORD}&quot;를 입력하세요
      </label>

      <input
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        disabled={deleting}
        className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-2 text-[15px] text-white outline-none focus:border-crimson/60"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setTyped("");
            setError("");
          }}
          disabled={deleting}
          className="flex-1 rounded-xl border border-white/15 px-4 py-2 text-[14px] font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          취소
        </button>

        <button
          type="button"
          onClick={confirmDelete}
          disabled={typed.trim() !== CONFIRM_WORD || deleting}
          className="flex-1 rounded-xl bg-crimson px-4 py-2 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? "삭제 중..." : "탈퇴하기"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-center text-[13px] text-crimson-bright">
          {error}
        </p>
      )}
    </div>
  );
}
