import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HAND_GUIDE, SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { buildJsonLd } from "@/lib/seo/structuredData";

const PAGE_URL = "https://seotda.felnut.com/rules";
const TITLE = "섯다 족보 가이드 - 광땡부터 망통까지 순위 총정리";
const DESCRIPTION =
  "섯다의 모든 족보를 순위대로 정리했습니다. 광땡·땡·알리·독사 같은 일반 족보부터 구사·땡잡이 같은 특수 족보까지 한눈에 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

const jsonLd = buildJsonLd({
  url: PAGE_URL,
  name: TITLE,
  description: DESCRIPTION,
});

function MiniCard({ cardId, alt }: { cardId: string; alt: string }) {
  return (
    <div className="relative h-16 w-10.5 shrink-0 overflow-hidden rounded-md border border-white/10 shadow-sm">
      <Image
        src={`/card/${cardId}.png`}
        alt={alt}
        fill
        sizes="42px"
        className="object-cover"
      />
    </div>
  );
}

export default function RulesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="mb-6 inline-block w-fit text-[13.5px] text-zinc-500 hover:text-zinc-300"
      >
        ← 돌아가기
      </Link>

      <h1 className="font-serif mb-2 text-[28px] font-black tracking-tight text-gold sm:text-[32px]">
        섯다 족보 가이드
      </h1>

      <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
        섯다는 두 장(때로는 세 장 중 두 장)의 카드가 이루는 월(月) 숫자 조합, 즉
        족보로 승부를 겨룹니다. 아래는 특수 족보와 일반 족보를 순위 높은 순으로
        정리한 표입니다. 게임 화면에서도 같은 내용을 가이드 패널로 바로 확인할
        수 있지만, 미리 훑어보고 들어가면 처음 하는 분도 훨씬 수월하게 즐길 수
        있습니다.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-[18px] font-bold text-zinc-200">특수 족보</h2>

        <p className="mb-4 text-[14.5px] leading-relaxed text-zinc-400">
          조건이 맞으면 순위표와 무관하게 즉시 무승부·재경기가 되거나 승패가
          뒤바뀌는 조합입니다. 상대의 패를 미처 예상하지 못했을 때 가장 짜릿한
          반전을 만들어냅니다.
        </p>

        <ul className="space-y-2.5">
          {SPECIAL_HAND_GUIDE.map((entry) => (
            <li
              key={entry.name}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 p-3"
            >
              <div className="flex gap-1">
                <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
              </div>

              <div>
                <p className="text-[17px] font-semibold text-zinc-100">
                  {entry.name}
                </p>
                <p className="text-[13.5px] text-zinc-500">{entry.months}</p>
                <p className="text-[13.5px] text-felt-bright">{entry.effect}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-bold text-zinc-200">
          일반 족보 (높은 순)
        </h2>

        <p className="mb-4 text-[14.5px] leading-relaxed text-zinc-400">
          특수 족보에 해당하지 않으면, 아래 순위표에 따라 더 높은 족보를 가진
          쪽이 이깁니다. 가장 높은 광땡부터 가장 낮은 망통까지, 총{" "}
          {HAND_GUIDE.length}개의 족보가 있습니다.
        </p>

        <ol className="space-y-2">
          {HAND_GUIDE.map((entry, index) => (
            <li
              key={entry.name}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[13px] font-bold text-zinc-400">
                {index + 1}
              </span>

              <div className="flex gap-1">
                <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
              </div>

              <div>
                <p className="text-[17px] font-semibold text-zinc-100">
                  {entry.name}
                </p>
                <p className="text-[13.5px] text-zinc-500">{entry.months}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/rooms"
        className="mt-10 w-full rounded-xl bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98]"
      >
        족보를 익혔다면, 방 찾아 바로 시작하기
      </Link>
    </main>
  );
}
