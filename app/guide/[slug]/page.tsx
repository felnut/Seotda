import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/app/components/AdSlot";
import { GUIDE_ARTICLES, getArticle } from "@/lib/guide/articles";
import { buildJsonLd } from "@/lib/seo/structuredData";

// 광고는 이렇게 실제 본문이 있는 글 페이지에만 싣는다.
// 콘솔에서 만들어 둔 사각형(300x250) 광고 단위를 재사용한다.
const ADSENSE_ARTICLE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_ROOMS_RECT_SLOT_ID ?? "";

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

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
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
  const next = GUIDE_ARTICLES[(index + 1) % GUIDE_ARTICLES.length];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-6 flex flex-col items-start text-[13.5px] text-zinc-500">
        <Link href="/" className="py-1 hover:text-zinc-300">
          ← 메인으로
        </Link>

        <Link href="/guide" className="py-1 hover:text-zinc-300">
          ← 이전으로
        </Link>
      </div>

      <article>
        <h1 className="mb-2 font-serif text-[26px] leading-snug font-black tracking-tight text-gold sm:text-[30px]">
          {article.title}
        </h1>

        <p className="mb-8 text-[13px] text-zinc-500">
          {article.dateModified} 업데이트
        </p>

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

      <div className="mt-8 flex w-full justify-center">
        <AdSlot slotId={ADSENSE_ARTICLE_SLOT_ID} width={300} height={250} />
      </div>

      <nav className="mt-10 flex flex-col gap-3">
        <Link
          href={`/guide/${next.slug}`}
          className="rounded-xl border border-white/10 bg-white/3 p-4 transition hover:border-gold/40"
        >
          <span className="block text-[12.5px] text-zinc-500">다음 글</span>
          <span className="text-[16px] font-semibold text-zinc-100">
            {next.title}
          </span>
        </Link>

        <Link
          href="/rooms"
          className="w-full rounded-xl bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98]"
        >
          방 찾아 바로 시작하기
        </Link>
      </nav>
    </main>
  );
}
