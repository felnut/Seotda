// 섯다 사이트의 각 페이지에서 재사용하는 JSON-LD 그래프. Organization은
// felnut.com 포트폴리오에서 쓰는 것과 동일한 @id를 그대로 재사용해
// "FELNUT"이 여러 사이트에 걸쳐 같은 발행 주체임을 크롤러가 연결지을
// 수 있게 한다.
const PORTFOLIO_URL = "https://www.felnut.com/";
const ORGANIZATION_ID = `${PORTFOLIO_URL}#organization`;
const PERSON_ID = `${PORTFOLIO_URL}#person`;

const SITE_URL = "https://seotda.felnut.com";
const WEBSITE_ID = `${SITE_URL}/#website`;

export function buildJsonLd({
  url,
  name,
  description,
  datePublished,
  dateModified,
  image,
}: {
  url: string;
  name: string;
  description: string;
  // git 히스토리 기준 실제 날짜(그 페이지 파일의 첫 커밋 / 최신 커밋).
  datePublished: string;
  dateModified: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "FELNUT",
        url: PORTFOLIO_URL,
        description:
          "프론트엔드, 임베디드 시스템, 데이터베이스를 공부하며 다양한 프로젝트를 개발하는 1인 개발자입니다.",
        logo: `${PORTFOLIO_URL}imgs/small_logo.png`,
        founder: { "@id": PERSON_ID },
        sameAs: ["https://github.com/felnut"],
        contactPoint: {
          "@type": "ContactPoint",
          email: "dev@felnut.com",
          contactType: "customer support",
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: "섯다",
        description: "친구와 온라인으로 즐기는 전통 섯다 카드 게임",
        inLanguage: "ko-KR",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: "ko-KR",
        isPartOf: { "@id": WEBSITE_ID },
        datePublished,
        dateModified,
        ...(image ? { primaryImageOfPage: image } : {}),
      },
    ],
  };
}
