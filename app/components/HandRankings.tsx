"use client";

import { useState } from "react";
import Image from "next/image";
import { HAND_GUIDE } from "@/lib/seotda/handGuide";

export function HandRankings() {
  const [query, setQuery] = useState("");
  const hands = HAND_GUIDE.map((entry, index) => ({ ...entry, rank: index + 1 }))
    .filter((entry) => `${entry.name} ${entry.months}`.includes(query.trim()));

  return (
    <>
      <label htmlFor="hand-search" className="field-label">족보 찾기</label>
      <input id="hand-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 월 조합 검색 · 예: 알리, 1월" className="lobby-input mb-3" />
      <p className="mb-4 text-sm text-zinc-400" role="status">{hands.length}개 족보 · 숫자가 작을수록 높은 순위예요.</p>
      <ol className="hand-rankings">
        {hands.map((entry) => (
          <li key={entry.name} value={entry.rank} className="flex items-center gap-3 rounded-lg border border-hairline bg-zinc-950 p-3">
            <span className="w-5 shrink-0 text-center text-sm text-zinc-400" aria-label={`${entry.rank}위`}>{entry.rank}</span>
            <div className="flex shrink-0 gap-1">
              {entry.cardIds.map((id) => <Image key={id} src={`/card/${id}.png`} alt="" width={32} height={49} className="rounded-sm object-cover" />)}
            </div>
            <div><p className="text-base font-semibold">{entry.name}</p><p className="text-sm text-zinc-400">{entry.months}</p></div>
          </li>
        ))}
      </ol>
      {hands.length === 0 && <p className="py-6 text-zinc-400">일치하는 족보가 없어요. 다른 이름이나 월로 검색해보세요.</p>}
    </>
  );
}
