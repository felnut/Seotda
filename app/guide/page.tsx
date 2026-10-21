import type { Metadata } from "next";
import Link from "next/link";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";
import { buildJsonLd } from "@/lib/seo/structuredData";

const PAGE_URL = "https://seotda.felnut.com/guide";
const TITLE = "섯다 가이드 - 처음 시작하기·족보·베팅";
const DESCRIPTION = "첫 판을 시작하는 순서, 족보 읽는 법, 베팅하는 법. 섯다에 필요한 세 가지 핵심 가이드입니다.";

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
  dateModified: "2026-10-21",
  image: "https://seotda.felnut.com/opengraph-image",
});

export default function GuideIndexPage() {
  return (
    <main className="guide-index">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="guide-intro">
        <p className="eyebrow">플레이 가이드</p>
        <h1>한 판에 필요한 것만.</h1>
        <p>시작부터 첫 베팅까지, 세 가지만 알아두세요.<br />나머지는 플레이하면서 익히면 돼요.</p>
      </header>
      <ol className="core-guides" aria-label="핵심 가이드">
        {GUIDE_ARTICLES.map((article, index) => (
          <li key={article.slug}>
            <Link href={`/guide/${article.slug}`}>
              <span className="guide-number" aria-hidden="true">0{index + 1}</span>
              <div><h2>{article.title}</h2><p>{article.summary}</p></div>
              <span className="guide-arrow" aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
      <aside className="guide-reference"><div><h2>족보가 헷갈릴 때</h2><p>모든 족보와 특수 규칙은 한곳에 모아뒀어요.</p></div><Link href="/rules">족보표 보기 <span aria-hidden="true">→</span></Link></aside>
      <footer className="guide-bottom"><p>읽었다면, 이제 직접 한 판.</p><Link href="/" className="primary-action">플레이 시작하기 <span aria-hidden="true">↗</span></Link></footer>
    </main>
  );
}
