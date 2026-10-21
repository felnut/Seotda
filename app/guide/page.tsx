import type { Metadata } from "next";
import Link from "next/link";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";
import { buildJsonLd } from "@/lib/seo/structuredData";

const PAGE_URL = "https://seotda.felnut.com/guide";
const TITLE = "섯다 가이드 - 규칙·족보·베팅 전략 모음";
const DESCRIPTION =
  "섯다를 처음 시작하는 방법부터 족보 순위, 특수 족보, 하프·쿼터·더블 베팅, 사이드 팟, 확률과 전략까지 정리한 가이드 글 모음입니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const jsonLd = buildJsonLd({
  url: PAGE_URL,
  name: TITLE,
  description: DESCRIPTION,
  datePublished: "2026-09-30",
  dateModified: "2026-09-30",
  image: "https://seotda.felnut.com/opengraph-image",
});

const GROUPS = [
  { id: "start", title: "처음 시작하기", slugs: ["getting-started", "common-mistakes", "room-guide"] },
  { id: "hands", title: "족보와 규칙", slugs: ["hand-rankings", "special-hands", "card-basics"] },
  { id: "strategy", title: "베팅과 전략", slugs: ["betting-ratios", "all-in-side-pot", "hand-probability", "when-to-fold", "reveal-strategy", "chip-management"] },
  { id: "system", title: "게임 시스템", slugs: ["ddaeng-fee", "ai-opponents"] },
  { id: "background", title: "용어와 배경 지식", slugs: ["glossary", "hwatu-months", "play-responsibly"] },
];
const FIRST_READS = ["getting-started", "hand-rankings", "betting-ratios"];

export default function GuideIndexPage() {
  return (
    <main className="reading-page mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="mb-6 inline-block w-fit py-1 text-[13.5px] text-zinc-500 hover:text-zinc-300"
      >
        ← 메인으로
      </Link>

      <h1 className="mb-2 font-serif text-[28px] font-black tracking-tight text-black sm:text-[32px]">
        한 판이 쉬워지는 가이드
      </h1>

      <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
        처음이라면 기본 규칙부터. 익숙해졌다면 베팅과 확률까지.
        지금 궁금한 내용을 골라 읽어보세요.
      </p>

      <section className="first-reads" aria-labelledby="first-reads-title">
        <h2 id="first-reads-title" className="mb-2 text-xl font-bold">처음이라면, 이 순서로</h2>
        <p className="mb-5 text-zinc-400">세 가지를 읽으면 첫 판을 시작할 준비가 돼요.</p>
        <ol className="space-y-3">
          {FIRST_READS.map((slug, index) => {
            const article = GUIDE_ARTICLES.find((item) => item.slug === slug)!;
            return <li key={slug}><Link href={`/guide/${slug}`} className="flex items-center gap-4 rounded-lg border border-hairline p-4 hover:border-gold"><span className="text-gold">0{index + 1}</span><span className="font-semibold">{article.title}</span><span className="ml-auto" aria-hidden="true">→</span></Link></li>;
          })}
        </ol>
      </section>
      <nav className="guide-nav" aria-label="가이드 주제">{GROUPS.map((group) => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}</nav>
      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="guide-section">
          <h2 className="mb-4 text-xl font-bold">{group.title}</h2>
          <ul className="flex flex-col gap-3">
            {GUIDE_ARTICLES.filter((article) => group.slugs.includes(article.slug)).map((article) => (
              <li key={article.slug}><Link href={`/guide/${article.slug}`} className="block rounded-xl border border-hairline bg-zinc-950 p-4 transition hover:border-gold"><h3 className="mb-2 text-base font-semibold">{article.title}</h3><p className="text-[15px] leading-7 text-zinc-400">{article.summary}</p></Link></li>
            ))}
          </ul>
        </section>
      ))}

      <Link
        href="/rooms"
        className="mt-10 w-full rounded-full bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-white transition hover:bg-gold-deep active:scale-[0.98]"
      >
        이제 한 판 즐기러 가기
      </Link>
    </main>
  );
}
