"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  RANKING_METRICS,
  RANKINGS_COLLECTION,
  RankingEntry,
} from "@/lib/ranking";

export function RankingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [metricIndex, setMetricIndex] = useState(0);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const metric = RANKING_METRICS[metricIndex];

  useEffect(() => {
    if (!open) return;

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

        const { collection, getDocs, limit, orderBy, query } = await import(
          "firebase/firestore"
        );

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
  }, [open, metric.field]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-semibold">랭킹</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 border-b border-white/10 px-5 py-3">
          {RANKING_METRICS.map((m, index) => (
            <button
              key={m.field}
              type="button"
              onClick={() => setMetricIndex(index)}
              className={`rounded-lg px-1.5 py-2 text-center text-[11.5px] leading-tight font-medium transition ${
                index === metricIndex
                  ? "bg-amber-400/15 text-amber-300"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="py-8 text-center text-[15px] text-zinc-500">
              불러오는 중...
            </p>
          )}

          {!loading && error && (
            <p className="py-8 text-center text-[15px] text-red-400">{error}</p>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="py-8 text-center text-[15px] text-zinc-500">
              아직 기록이 없습니다.
            </p>
          )}

          {!loading && !error && entries.length > 0 && (
            <ol className="space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.name}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[15px] font-bold text-zinc-400">
                    {index + 1}
                  </span>

                  <p className="flex-1 truncate text-[17.5px] font-semibold">
                    {entry.name}
                  </p>

                  <p className="text-[15px] font-medium text-amber-300">
                    {metric.format(entry)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
