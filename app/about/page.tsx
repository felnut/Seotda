import type { Metadata } from "next";
import Link from "next/link";
import { buildJsonLd } from "@/lib/seo/structuredData";

const PAGE_URL = "https://seotda.felnut.com/about";
const TITLE = "섯다란? - 친구와 온라인으로 즐기는 전통 카드 게임 소개";
const DESCRIPTION =
  "섯다가 어떤 게임인지, 이 사이트에서 무엇을 할 수 있는지, 어떻게 시작하는지 한 번에 정리했습니다.";

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

export default function AboutPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center gap-6 px-4 py-10 sm:py-14 xl:flex-row xl:justify-center">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Link href="/" className="mb-8 w-fit text-sm text-zinc-400">← 로비로</Link>
        <p className="eyebrow">우리의 테이블</p>
        <h1 className="my-5 text-4xl font-bold tracking-tight">멀리 있어도,<br />한 테이블에 둘러앉듯.</h1>
        <p className="mb-10 text-base leading-8 text-zinc-400">섯다는 두 장의 화투로 승부를 겨루는 카드 게임이에요.
          좋은 패를 기다리는 설렘도, 상대의 선택을 읽는 재미도 친구와 함께 나눠보세요.</p>
        <section className="mb-10 border-y border-hairline py-7">
          <h2 className="mb-5 text-xl font-bold">시작은 간단해요</h2>
          <ol className="space-y-5 text-sm text-zinc-400">
            <li><strong className="mr-3 text-gold">01</strong> 방을 만들고, 친구에게 방 이름을 알려주세요.</li>
            <li><strong className="mr-3 text-gold">02</strong> 2–6명이 모이면 준비 완료. 혼자라면 AI를 추가하세요.</li>
            <li><strong className="mr-3 text-gold">03</strong> 모두 준비되면 방장이 게임을 시작해요.</li>
          </ol>
        </section>
        <section className="mb-10 space-y-6">
          <h2 className="text-xl font-bold">궁금한 점이 있나요?</h2>
          <details className="border-b border-hairline pb-5" open><summary className="font-semibold">로그인이 필요한가요?</summary><p className="mt-3 text-sm leading-7 text-zinc-400">게스트로 바로 즐길 수 있어요. 로그인하면 보유 칩과 랭킹 기록이 계정에 저장돼요. AI가 참여한 방은 랭킹에 반영되지 않아요.</p></details>
          <details className="border-b border-hairline pb-5"><summary className="font-semibold">실제 돈을 사용하나요?</summary><p className="mt-3 text-sm leading-7 text-zinc-400">게임용 칩으로만 플레이해요. 결제나 환전 기능은 없어요.</p></details>
          <details className="border-b border-hairline pb-5"><summary className="font-semibold">규칙을 몰라도 괜찮을까요?</summary><p className="mt-3 text-sm leading-7 text-zinc-400">AI와 먼저 한 판 연습해보세요. 게임 화면에서 족보를 확인할 수 있고, <Link href="/rules" className="text-gold underline underline-offset-4">족보와 규칙</Link>에도 진행 방법을 정리해두었어요.</p></details>
          <details className="border-b border-hairline pb-5"><summary className="font-semibold">휴대폰에서도 할 수 있나요?</summary><p className="mt-3 text-sm leading-7 text-zinc-400">별도 설치 없이 휴대폰과 PC 브라우저에서 즐길 수 있어요.</p></details>
        </section>
        <Link href="/" className="primary-action">우리만의 방 만들기 <span aria-hidden="true">↗</span></Link>
      </div>
    </main>
  );
}
