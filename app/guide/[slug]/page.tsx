import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
// import { AdSlot } from "@/app/components/AdSlot";
import { GUIDE_ARTICLES, getArticle } from "@/lib/guide/articles";
import { buildJsonLd } from "@/lib/seo/structuredData";

// 광고는 이렇게 실제 본문이 있는 글 페이지에만 싣는다.
// 콘솔에서 만들어 둔 사각형(300x250) 광고 단위를 재사용한다.
// 보안 문제 점검 중 가이드 글 광고를 일시 중지한다.
// const ADSENSE_ARTICLE_SLOT_ID =
//   process.env.NEXT_PUBLIC_ADSENSE_ROOMS_RECT_SLOT_ID ?? "";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return GUIDE_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const article = getArticle((await params).slug);

  if (!article) return {};

  const url = `https://seotda.felnut.com/guide/${article.slug}`;
  const title = `섯다 ${article.title} | 섯다 가이드`;

  return {
    title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: article.description,
      type: "article",
    },
  };
}

export default async function GuideArticlePage({ params }: { params: Params }) {
  const article = getArticle((await params).slug);

  if (!article) notFound();

  const url = `https://seotda.felnut.com/guide/${article.slug}`;
  const jsonLd = buildJsonLd({
    url,
    name: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    image: "https://seotda.felnut.com/opengraph-image",
  });

  const index = GUIDE_ARTICLES.findIndex((a) => a.slug === article.slug);
  const next = GUIDE_ARTICLES[index + 1];

  return (
    <main className="guide-article reading-page mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="article-breadcrumb" aria-label="현재 위치"><Link href="/guide">가이드</Link><span aria-hidden="true">/</span><span>{article.title}</span></nav>

      <article>
        <header className="article-intro"><p className="eyebrow">0{index + 1} / 03</p><h1>{article.title}</h1><p>{article.summary}</p></header>

        {article.body.map((block, i) => {
          if (block.type === "h") {
            return (
              <h2
                key={i}
                className="mt-8 mb-2 text-[18px] font-bold text-zinc-200"
              >
                {block.text}
              </h2>
            );
          }

          if (block.type === "p") {
            return (
              <p
                key={i}
                className="mb-4 text-[15px] leading-[1.8] text-zinc-400"
              >
                {block.text}
              </p>
            );
          }

          const List = block.type === "ol" ? "ol" : "ul";

          return (
            <List
              key={i}
              className={`mb-4 space-y-1.5 pl-5 text-[15px] leading-[1.8] text-zinc-400 ${
                block.type === "ol" ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          );
        })}
      </article>

      {/* {ADSENSE_ARTICLE_SLOT_ID && <div className="mt-8 flex w-full justify-center"><AdSlot slotId={ADSENSE_ARTICLE_SLOT_ID} width={300} height={250} /></div>} */}

      <nav className="mt-10 flex flex-col gap-3">
        {next && <Link
          href={`/guide/${next.slug}`}
          className="rounded-xl border border-hairline bg-zinc-950 p-4 transition hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.99]"
        >
          <span className="block text-[12.5px] text-zinc-500">다음 글</span>
          <span className="text-[16px] font-semibold text-zinc-100">
            {next.title}
          </span>
        </Link>}

        <Link
          href="/"
          className="primary-action"
        >
          플레이 시작하기
        </Link>
      </nav>
    </main>
  );
}
