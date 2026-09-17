import type { Metadata } from "next";
import Link from "next/link";
import { buildJsonLd } from "@/lib/seo/structuredData";
import { AdSlot } from "../components/AdSlot";

// 로비 화면 좌우에 쓰는 것과 같은 세로형 광고 단위를 그대로 재사용한다.
const ADSENSE_LOBBY_SIDE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_LOBBY_SIDE_SLOT_ID ?? "";

const PAGE_URL = "https://seotda.felnut.com/about";
const TITLE = "섯다란? - 친구와 온라인으로 즐기는 전통 카드 게임 소개";
const DESCRIPTION =
  "섯다가 어떤 게임인지, 이 사이트에서 무엇을 할 수 있는지, 어떻게 시작하는지 한 번에 정리했습니다.";

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
  // git 히스토리 기준: 이 파일의 첫 커밋일이 곧 최신 커밋일(같은 날 작성).
  datePublished: "2026-09-12",
  dateModified: "2026-09-12",
  image: "https://seotda.felnut.com/opengraph-image",
});

export default function AboutPage() {
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

      <h1 className="mb-6 flex flex-col gap-1">
        <span className="font-serif text-[28px] font-black tracking-tight text-gold sm:text-[32px]">
          섯다란?
        </span>

        <span className="text-[15px] font-normal text-zinc-500">
          친구와 온라인으로 즐기는 전통 카드 게임 소개
        </span>
      </h1>

      <p className="mb-4 text-[14.5px] leading-relaxed text-zinc-400">
        이 사이트는 친구와 온라인으로 즐기는 전통 카드 게임, 섯다를 다룹니다.
        섯다는 화투 카드 20장 중 2장(경우에 따라 3장)만으로 승부를 겨루는 한국의
        전통 카드 게임으로, 두 장의 카드가 이루는 월(月) 숫자 조합, 즉 족보의
        높낮이를 겨룹니다. 광땡·알리·독사· 구사 같은 특수 족보가 나오면 판의
        흐름이 순식간에 뒤바뀌는 것이 이 게임의 가장 큰 매력입니다.
      </p>

      <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
        명절에 온 가족이 둘러앉아 즐기던 놀이를 이제는 브라우저만 있으면 언제
        어디서나, 멀리 있는 친구와도 함께 즐길 수 있습니다. 방을 하나 만들어 방
        이름만 알려주면 곧바로 접속할 수 있고, 인원이 둘뿐이어도 AI를 채워 바로
        대전을 시작할 수 있어 별도의 설치나 준비 없이 바로 즐기는 전통 카드
        게임을 경험할 수 있습니다.
      </p>

      <h2 className="mb-2 text-[18px] font-bold text-zinc-200">주요 기능</h2>

      <ul className="mb-8 list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-zinc-400">
        <li>
          실시간 멀티플레이 — 지연 없는 실시간 통신으로 베팅과 카드 공개가
          바로바로 반영됩니다.
        </li>
        <li>
          친구와 함께 — 비밀번호를 걸어 나만의 방을 만들고, 방 이름만 공유하면
          친구를 초대할 수 있습니다.
        </li>
        <li>
          AI 상대 — 인원이 부족해도 AI 플레이어를 채워 곧바로 게임을 시작할 수
          있습니다.
        </li>
        <li>
          구글 로그인과 랭킹 — 로그인하면 보유 칩이 계정에 저장되고, 랭킹에서
          다른 플레이어들과 순위를 겨룰 수 있습니다.
        </li>
        <li>
          실시간 채팅과 이모티콘 — 게임 도중에도 대화를 나누며 분위기를 즐길 수
          있습니다.
        </li>
        <li>
          족보 가이드 — 헷갈리기 쉬운 광땡·알리·독사·구사 같은 족보를 게임
          화면과{" "}
          <Link
            href="/rules"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            족보 가이드 페이지
          </Link>
          에서 바로 확인할 수 있습니다.
        </li>
      </ul>

      <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
        시작하는 방법
      </h2>

      <ol className="mb-8 list-decimal space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-zinc-400">
        <li>
          닉네임을 입력합니다. 선택 사항이며, 입력하지 않으면 자동으로 이름이
          부여됩니다.
        </li>
        <li>
          <Link
            href="/"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            방 만들기
          </Link>
          로 새 게임방을 열거나,{" "}
          <Link
            href="/rooms"
            className="text-gold-bright underline underline-offset-2 hover:text-gold"
          >
            열려 있는 방 목록
          </Link>
          에서 이미 열려 있는 방에 참가합니다.
        </li>
        <li>2명 이상 모이면 방장이 게임을 시작할 수 있습니다.</li>
      </ol>

      <h2 className="mb-2 text-[18px] font-bold text-zinc-200">
        자주 묻는 질문
      </h2>

      <div className="mb-10 space-y-4">
        <div>
          <p className="mb-1 text-[14.5px] font-semibold text-zinc-200">
            몇 명이서 즐길 수 있나요?
          </p>
          <p className="text-[14.5px] leading-relaxed text-zinc-400">
            한 방에 최소 2명, 최대 6명까지 참가할 수 있습니다. 인원이 모자라면
            방장이 &ldquo;AI 추가&rdquo; 버튼으로 빈 자리를 채워 혼자서도
            바로 시작할 수 있습니다.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[14.5px] font-semibold text-zinc-200">
            실제 돈을 걸어야 하나요?
          </p>
          <p className="text-[14.5px] leading-relaxed text-zinc-400">
            아닙니다. 모든 참가자는 시작 시 10,000칩을 받아 재미로만
            사용하며, 결제나 환전 기능은 제공하지 않습니다.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[14.5px] font-semibold text-zinc-200">
            로그인하지 않아도 되나요?
          </p>
          <p className="text-[14.5px] leading-relaxed text-zinc-400">
            네, 닉네임만 입력하면 로그인 없이 바로 참가할 수 있습니다. 다만
            구글 로그인을 하면 보유 칩이 계정에 저장되고 랭킹에도
            반영됩니다.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[14.5px] font-semibold text-zinc-200">
            칩을 다 잃으면 게임이 끝나나요?
          </p>
          <p className="text-[14.5px] leading-relaxed text-zinc-400">
            그 판에서는 관전자로 전환되지만, 참가자 전원이 &ldquo;다시하기&rdquo;에
            동의하면 모두 시작 칩으로 초기화되어 다시 도전할 수 있습니다.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[14.5px] font-semibold text-zinc-200">
            모바일에서도 할 수 있나요?
          </p>
          <p className="text-[14.5px] leading-relaxed text-zinc-400">
            네, 별도 앱 설치 없이 모바일 브라우저에서도 PC와 동일하게
            즐길 수 있습니다.
          </p>
        </div>
      </div>

      <p className="mb-10 text-[13.5px] text-zinc-500">
        섯다의 자세한 규칙과 유래가 궁금하다면{" "}
        <a
          href="https://ko.wikipedia.org/wiki/%EC%84%AF%EB%8B%A4"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-bright underline underline-offset-2 hover:text-gold"
        >
          위키백과의 섯다 문서
        </a>
        를 참고해보세요.
      </p>

      <Link
        href="/rooms"
        className="w-full rounded-xl bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98]"
      >
        방 찾아 바로 시작하기
      </Link>
      </div>

      <div className="hidden shrink-0 xl:block">
        <AdSlot slotId={ADSENSE_LOBBY_SIDE_SLOT_ID} width={160} height={600} />
      </div>
    </main>
  );
}
