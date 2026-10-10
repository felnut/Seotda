"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  RANKING_METRICS,
  RANKINGS_COLLECTION,
  RankingEntry,
} from "@/lib/ranking";
import { EmptyState } from "../components/EmptyState";

// 기록이 1~4개뿐이어도 목록이 휑해 보이지 않도록, 상위 자리를 이 개수까지
// 빈 슬롯(placeholder)으로 채워 보여준다.
const MIN_DISPLAY_SLOTS = 5;

export function RankingPageClient() {
  const [metricIndex, setMetricIndex] = useState(0);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const metric = RANKING_METRICS[metricIndex];

  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError("");

        return getFirebaseDb();
      })
      .then(async (firestore) => {
        if (!firestore) {
          if (!cancelled) {
            setError("랭킹 기능이 아직 설정되지 않았습니다.");
          }

          return;
        }

        const { collection, getDocs, limit, orderBy, query } =
          await import("firebase/firestore");

        if (cancelled) return;

        const q = query(
          collection(firestore, RANKINGS_COLLECTION),
          orderBy(metric.field, "desc"),
          limit(20),
        );

        const snapshot = await getDocs(q);

        if (cancelled) return;

        setEntries(snapshot.docs.map((doc) => doc.data() as RankingEntry));
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("랭킹을 불러오지 못했습니다:", err);
        setError("랭킹을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metric.field]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="mb-6 inline-block w-fit py-1 text-[13.5px] text-zinc-500 hover:text-zinc-300"
      >
        ← 메인으로
      </Link>

      <h1 className="mb-2 font-serif text-[28px] font-black tracking-tight text-black sm:text-[32px]">
        랭킹
      </h1>

      <p className="mb-6 text-[14.5px] leading-relaxed text-zinc-400">
        로그인한 플레이어끼리의 기록입니다. AI가 함께한 방의 결과는
        반영되지 않습니다.
      </p>

        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {RANKING_METRICS.map((m, index) => (
            <button
              key={m.field}
              type="button"
              onClick={() => setMetricIndex(index)}
              className={`rounded-full px-1.5 py-2 text-center text-[11.5px] leading-tight font-medium transition ${
                index === metricIndex
                  ? "bg-gold/15 text-black"
                  : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {loading && (
            <p className="py-8 text-center text-[15px] text-zinc-500">
              불러오는 중...
            </p>
          )}

          {!loading && error && (
            <p className="py-8 text-center text-[15px] text-crimson-bright">
              {error}
            </p>
          )}

          {!loading && !error && entries.length === 0 && (
            <EmptyState
              title="아직 기록이 없습니다"
              subtitle="게임을 한 판 마치면 이 자리에 순위가 쌓여요."
            />
          )}

          {!loading && !error && entries.length > 0 && (
            <ol className="space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.name}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-hairline bg-zinc-950 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[15px] font-bold text-zinc-400">
                    {index + 1}
                  </span>

                  <p className="flex-1 truncate text-[17.5px] font-semibold">
                    {entry.name}
                  </p>

                  <p className="font-mono text-[15px] font-medium tabular-nums text-black">
                    {metric.format(entry)}
                  </p>
                </li>
              ))}

              {/* 기록이 몇 개 안 될 때도 목록이 휑해 보이지 않도록, 남은
                  순위 칸을 옅은 빈 슬롯으로 채워 "곧 채워질 자리"처럼 보이게 한다. */}
              {Array.from({
                length: Math.max(0, MIN_DISPLAY_SLOTS - entries.length),
              }).map((_, index) => (
                <li
                  key={`placeholder-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-hairline p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-zinc-700">
                    {entries.length + index + 1}
                  </span>

                  <p className="flex-1 text-[15px] text-zinc-700">아직 없음</p>
                </li>
              ))}
            </ol>
          )}
        </div>
    </main>
  );
}
