import type { Metadata } from "next";
import { buildJsonLd } from "@/lib/seo/structuredData";
import { RoomsPageClient } from "./RoomsPageClient";

const PAGE_URL = "https://seotda.felnut.com/rooms";
const TITLE = "방 찾기 - 섯다 온라인 대전방 목록";
const DESCRIPTION =
  "지금 열려 있는 섯다 게임방 목록을 확인하고 바로 참가하세요. 참가할 방이 없다면 새 방을 만들어 친구를 초대할 수 있습니다.";

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
  // git 히스토리 기준.
  datePublished: "2026-09-01",
  dateModified: "2026-09-14",
  image: "https://seotda.felnut.com/opengraph-image",
});

export default function RoomsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RoomsPageClient />
    </>
  );
}
