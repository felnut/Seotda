import type { Metadata } from "next";
import Link from "next/link";
import { buildJsonLd } from "@/lib/seo/structuredData";
import { AdSlot } from "../components/AdSlot";

// 로비 화면 좌우에 쓰는 것과 같은 세로형 광고 단위를 그대로 재사용한다.
const ADSENSE_LOBBY_SIDE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_LOBBY_SIDE_SLOT_ID ?? "";

const PAGE_URL = "https://seotda.felnut.com/privacy";
const TITLE = "개인정보처리방침 - 섯다";
const DESCRIPTION =
  "섯다 사이트가 수집하는 개인정보 항목, 이용 목적, 보관 기간과 광고·분석 도구 사용 내역을 안내합니다.";
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

export default function PrivacyPage() {
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
          개인정보처리방침
        </h1>

        <p className="mb-8 text-[13px] text-zinc-500">
          시행일자: {EFFECTIVE_DATE}
        </p>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          섯다(이하 &ldquo;사이트&rdquo;)는 이용자의 개인정보를 소중히
          다루며, 아래와 같이 수집·이용·보관합니다. 사이트는 1인 개발자가
          운영하는 무료 서비스로, 별도의 법인이나 사업자가 아닙니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          수집하는 개인정보 항목
        </h2>

        <ul className="mb-8 list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-zinc-400">
          <li>
            게스트 참여 시: 직접 입력한 닉네임뿐이며, 이는 브라우저에만
            저장되고 서버에 계정으로 보관되지 않습니다.
          </li>
          <li>
            Google 로그인 시: 이메일 주소, 표시 이름 등 Google 계정 정보
            일부와, 사이트 내에서 설정한 닉네임·보유 칩(뱅크롤)·승패
            기록이 Firestore(Google Firebase)에 저장됩니다.
          </li>
          <li>
            서비스 이용 과정에서 자동으로 생성되는 접속 로그, 기기·브라우저
            정보(Vercel Analytics를 통한 익명 통계).
          </li>
        </ul>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          이용 목적
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          로그인 유지와 재접속 시 좌석·기록 복구, 닉네임·보유 칩 등 프로필
          정보 제공, 랭킹 기능 운영, 서비스 이용 통계 분석과 품질 개선
          목적으로만 사용합니다. 광고 목적으로 별도로 개인정보를 수집하지
          않습니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          보관 기간
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          Google 계정으로 로그인한 정보는 이용자가 직접 삭제를 요청하거나
          계정을 탈퇴할 때까지 보관됩니다. 게스트로 입력한 닉네임은
          브라우저의 로컬 저장소에만 남으며, 브라우저 데이터를 지우면 함께
          삭제됩니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          제3자 서비스와 광고
        </h2>

        <ul className="mb-8 list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-zinc-400">
          <li>
            <strong className="text-zinc-200">Google Firebase</strong> —
            로그인 인증과 프로필·랭킹 데이터 저장에 사용합니다.
          </li>
          <li>
            <strong className="text-zinc-200">Google AdSense</strong> — 광고
            게재와 맞춤 광고 제공을 위해 쿠키를 사용할 수 있습니다. 맞춤
            광고는{" "}
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-bright underline underline-offset-2 hover:text-gold"
            >
              Google 광고 설정
            </a>
            에서 언제든지 해제할 수 있습니다.
          </li>
          <li>
            <strong className="text-zinc-200">
              Vercel Analytics / Speed Insights
            </strong>{" "}
            — 방문 통계와 성능 측정을 위한 익명 집계 데이터를 수집합니다.
          </li>
        </ul>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
          이용자의 권리
        </h2>

        <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
          이용자는 언제든지 자신의 개인정보 열람·정정·삭제를 요청할 수
          있으며, 아래 문의처로 연락하면 지체 없이 조치합니다.
        </p>

        <h2 className="mb-2 text-[18px] font-bold text-zinc-200">문의</h2>

        <p className="mb-10 text-[14.5px] leading-relaxed text-zinc-400">
          개인정보 관련 문의는{" "}
          <a
            href="mailto:dev@felnut.com"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            dev@felnut.com
          </a>
          으로 연락해주세요.
        </p>

        <p className="text-[13px] text-zinc-500">
          이 방침은 서비스 내용 변경에 따라 개정될 수 있으며, 변경 시 이
          페이지를 통해 안내합니다.
        </p>
      </div>

      <div className="hidden shrink-0 xl:block">
        <AdSlot slotId={ADSENSE_LOBBY_SIDE_SLOT_ID} width={160} height={600} />
      </div>
    </main>
  );
}
