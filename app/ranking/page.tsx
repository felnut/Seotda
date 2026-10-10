import type { Metadata } from "next";
import { RankingPageClient } from "./RankingPageClient";

const PAGE_URL = "https://seotda.felnut.com/ranking";
const TITLE = "랭킹 - 섯다 승수·승률 순위";
const DESCRIPTION =
  "섯다 온라인 플레이어들의 승수, 승률, 보유 칩 순위를 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function RankingPage() {
  return <RankingPageClient />;
}
