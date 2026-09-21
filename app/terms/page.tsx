import type { Metadata } from "next";
import Link from "next/link";
import { buildJsonLd } from "@/lib/seo/structuredData";
import { AdSlot } from "../components/AdSlot";

// 로비 화면 좌우에 쓰는 것과 같은 세로형 광고 단위를 그대로 재사용한다.
const ADSENSE_LOBBY_SIDE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_LOBBY_SIDE_SLOT_ID ?? "";

const PAGE_URL = "https://seotda.felnut.com/terms";
const TITLE = "이용약관 - 섯다";
const DESCRIPTION =
  "섯다 사이트를 이용하기 전 알아야 할 서비스 성격, 칩의 의미, 이용자 의무와 책임의 한계를 안내합니다.";
const EFFECTIVE_DATE = "2026-09-21";

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
  datePublished: EFFECTIVE_DATE,
  dateModified: EFFECTIVE_DATE,
});

export default function TermsPage() {
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

        <h1 className="mb-2 font-serif text-[28px] font-black tracking-tight text-gold sm:text-[32px]">
          이용약관
        </h1>

        <p className="mb-8 text-[13px] text-zinc-500">
          시행일자: {EFFECTIVE_DATE}
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          1. 서비스의 성격
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          섯다(이하 &ldquo;사이트&rdquo;)는 친구와 온라인으로 즐기는 전통
          카드 게임을 무료로 제공하는 개인 프로젝트입니다. 게임 내 &ldquo;칩&rdquo;은
          오직 게임 진행을 위한 가상의 점수이며, 실제 금전적 가치를
          가지지 않습니다. 사이트는 칩의 충전, 환전, 현금화, 타인에게로의
          양도를 일절 지원하지 않으며 이를 중개하지도 않습니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          2. 이용자의 의무
        </h2>

        <ul className="mb-8 list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-zinc-400">
          <li>
            타인을 비방하거나 불쾌감을 주는 닉네임·채팅 내용을 사용하지
            않습니다.
          </li>
          <li>
            자동화 프로그램(매크로·봇) 사용, 버그·취약점을 악용한 부정
            이용을 하지 않습니다.
          </li>
          <li>
            사이트 밖에서 칩이나 게임 결과를 매개로 한 금전 거래를
            시도하지 않습니다.
          </li>
        </ul>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          3. 서비스의 변경과 중단
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          사이트는 무료로 제공되는 개인 프로젝트로, 기능 변경이나 서비스
          중단이 사전 고지 없이 이루어질 수 있습니다. 서버 점검, 배포, 그
          밖의 사유로 방·게임 데이터, 보유 칩, 랭킹 기록이 초기화되거나
          손실될 수 있으며, 사이트는 이에 대한 책임을 지지 않습니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          4. 책임의 한계
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          사이트는 &ldquo;있는 그대로&rdquo; 무상으로 제공되며, 서비스
          이용 과정에서 발생하는 손해에 대해 법이 허용하는 최대한의
          범위에서 책임을 지지 않습니다. Google 로그인 이용 시에는 Google의
          자체 약관과 정책도 함께 적용됩니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          5. 약관의 변경
        </h2>

        <p className="mb-10 text-[14.5px] leading-relaxed text-zinc-400">
          이 약관은 서비스 내용 변경에 따라 개정될 수 있으며, 변경 시 이
          페이지를 통해 안내합니다. 개인정보 처리에 관한 내용은{" "}
          <Link
            href="/privacy"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            개인정보처리방침
          </Link>
          을 참고해주세요.
        </p>

        <p className="text-[13px] text-zinc-500">
          문의:{" "}
          <a
            href="mailto:dev@felnut.com"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            dev@felnut.com
          </a>
        </p>
      </div>

      <div className="hidden shrink-0 xl:block">
        <AdSlot slotId={ADSENSE_LOBBY_SIDE_SLOT_ID} width={160} height={600} />
      </div>
    </main>
  );
}
