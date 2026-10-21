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

export default function GuideIndexPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
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

      <ul className="flex flex-col gap-3">
        {GUIDE_ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/guide/${article.slug}`}
              className="block rounded-xl border border-hairline bg-zinc-950 p-4 transition hover:border-hairline hover:bg-zinc-800"
            >
              <h2 className="mb-1 text-[17px] font-semibold text-zinc-100">
                {article.title}
              </h2>

              <p className="text-[13.5px] leading-relaxed text-zinc-400">
                {article.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/rooms"
        className="mt-10 w-full rounded-full bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-white transition hover:bg-gold-deep active:scale-[0.98]"
      >
        이제 한 판 즐기러 가기
      </Link>
    </main>
  );
}
