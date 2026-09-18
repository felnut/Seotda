import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HAND_GUIDE, SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { buildJsonLd } from "@/lib/seo/structuredData";
import { AdSlot } from "../components/AdSlot";

// 로비 화면 좌우에 쓰는 것과 같은 세로형 광고 단위를 그대로 재사용한다.
const ADSENSE_LOBBY_SIDE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_LOBBY_SIDE_SLOT_ID ?? "";

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
  // git 히스토리 기준: 이 파일의 첫 커밋일이 곧 최신 커밋일(같은 날 작성).
  datePublished: "2026-09-12",
  dateModified: "2026-09-12",
  image: "https://seotda.felnut.com/opengraph-image",
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
    <main className="flex min-h-screen w-full flex-col items-center gap-6 px-4 py-10 sm:py-14 xl:flex-row xl:justify-center">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="hidden shrink-0 xl:block">
        <AdSlot slotId={ADSENSE_LOBBY_SIDE_SLOT_ID} width={160} height={600} />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col">
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
          섯다는 두 장(때로는 세 장 중 두 장)의 카드가 이루는 월(月) 숫자 조합,
          즉 족보로 승부를 겨룹니다. 아래는 특수 족보와 일반 족보를 순위 높은
          순으로 정리한 표입니다. 게임 화면에서도 같은 내용을 가이드 패널로 바로
          확인할 수 있지만, 미리 훑어보고 들어가면 처음 하는 분도 훨씬 수월하게
          즐길 수 있습니다.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-bold text-zinc-200">
            게임은 이렇게 진행됩니다
          </h2>

          <ol className="space-y-2 text-[14.5px] leading-relaxed text-zinc-400">
            <li>
              <span className="font-semibold text-zinc-200">
                1. 시작금(앤티) 징수
              </span>{" "}
              — 참가자 전원이 100칩씩 자동으로 판돈에 냅니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">2. 카드 배분</span>{" "}
              — 화투 카드 2장을 받아 자신만 확인합니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">3. 1차 베팅</span> —
              체크·콜·하프/쿼터/더블·올인·다이 중 하나를 골라 판을 키우거나
              접습니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">
                4. 3번째 카드 & 공개
              </span>{" "}
              — 한 장을 더 받아 3장이 되고, 그중 한 장을 상대에게 공개합니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">5. 2차 베팅</span> —
              공개된 카드를 참고해 다시 한 번 베팅합니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">
                6. 족보 선택 &amp; 쇼다운
              </span>{" "}
              — 3장 중 최종 족보로 쓸 2장을 스스로 고르면, 남은 참가자끼리
              족보를 비교해 승자가 판돈을 가져갑니다.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-bold text-zinc-200">
            베팅 액션 알아보기
          </h2>

          <ul className="space-y-2 text-[14.5px] leading-relaxed text-zinc-400">
            <li>
              <span className="font-semibold text-zinc-200">체크</span> — 추가로
              내는 돈 없이 차례를 넘깁니다. 현재 베팅액과 자신의 베팅액이 같을
              때만 가능합니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">콜</span> — 현재
              최고 베팅 금액까지 자신의 베팅액을 맞춥니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">
                하프 / 쿼터 / 더블
              </span>{" "}
              — 섯다 특유의 배율 베팅입니다. 현재 판돈의 1/2, 1/4, 2배를 베팅해
              판을 키웁니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">올인</span> — 남은
              칩을 전부 겁니다. 여러 명이 서로 다른 금액으로 올인하면 사이드
              팟으로 나뉘어 정산됩니다.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">다이</span> — 승부를
              포기하고 이번 판에서 빠집니다.
            </li>
          </ul>

          <p className="mt-4 text-[13.5px] text-zinc-500">
            모든 참가자는 10,000칩으로 시작하며, 판마다 참가자 평균 보유 칩을
            기준으로 판당 최대 베팅 한도가 정해져 한 판에 너무 큰 칩이 걸리지
            않도록 합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-bold text-zinc-200">
            특수 족보
          </h2>

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
                  <p className="text-[13.5px] text-felt-bright">
                    {entry.effect}
                  </p>
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
      </div>

      <div className="hidden shrink-0 xl:block">
        <AdSlot slotId={ADSENSE_LOBBY_SIDE_SLOT_ID} width={160} height={600} />
      </div>
    </main>
  );
}
