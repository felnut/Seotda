import type { Metadata } from "next";
import Link from "next/link";
import { SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { HandRankings, CardPair } from "@/app/components/HandRankings";
import { SiteFooter } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "섯다 족보와 규칙",
  description:
    "광땡부터 망통까지 실제 카드로 확인하는 족보표. 특수 족보, 끗 계산과 세 장 섯다 규칙을 안내합니다.",
  alternates: { canonical: "https://seotda.felnut.com/rules" },
};

export default function RulesPage() {
  return (
    <>
      <main className="rules-layout ornament-corners">
        <aside className="rules-sidebar">
          <nav aria-label="규칙 목차">
            <a href="#rankings">일반 족보</a>
            <a href="#special-hands">특수 족보</a>
            <a href="#points">끗 계산</a>
            <a href="#flow">게임 규칙</a>
          </nav>
        </aside>
        <div className="rules-content">
          <p className="breadcrumb">
            <Link href="/">홈</Link>
            <span>/</span>족보와 규칙
          </p>
          <h1 className="page-title">족보와 규칙</h1>
          <p className="page-description">
            두 장의 조합을 확인하고, 한 판의 흐름을 익혀보세요.
          </p>
          <section id="rankings" className="rules-section">
            <div className="section-heading">
              <h2>일반 족보</h2>
              <span>높은 순서</span>
            </div>
            <HandRankings />
          </section>
          <section id="special-hands" className="rules-section">
            <h2>특수 족보</h2>
            <ul className="special-hands">
              {SPECIAL_HAND_GUIDE.map((hand) => (
                <li key={hand.name}>
                  <h3>{hand.name}</h3>
                  <CardPair ids={hand.cardIds} name={hand.name} />
                  <p>{hand.months}</p>
                  <p>{hand.effect}</p>
                </li>
              ))}
            </ul>
            <p className="rules-note">
              땡잡이는 장땡을, 암행어사는 38광땡을 이길 수 없습니다. 구사 계열은
              조건에 맞을 때 재경기합니다.
            </p>
          </section>
          <section id="points" className="rules-section text-section">
            <h2>끗 계산</h2>
            <p>
              이름이 붙은 족보가 아니라면 두 카드의 월을 더한 끝자리가 끗입니다.
              7월과 8월은 15이므로 5끗입니다. 9끗은 갑오, 0끗은 망통이라고
              부릅니다.
            </p>
          </section>
          <section id="flow" className="rules-section text-section">
            <h2>게임 규칙</h2>
            <p>
              1~10월 화투를 두 장씩, 총 20장 사용합니다. 이 사이트는 세 장을
              받아 마지막에 두 장을 고르는 방식입니다.
            </p>
            <ol className="flow-steps">
              <li>100칩씩 내고 카드 두 장을 받습니다.</li>
              <li>1차 베팅 후 한 장을 더 받습니다.</li>
              <li>세 장 중 한 장을 상대에게 공개합니다.</li>
              <li>2차 베팅 후 족보로 쓸 두 장을 고릅니다.</li>
              <li>남은 참가자의 족보를 비교해 판돈을 나눕니다.</li>
            </ol>
          </section>
          <section id="betting" className="rules-section text-section">
            <h2>베팅 금액</h2>
            <p>
              체크는 추가 금액 없이 차례를 넘기고, 콜은 상대가 올린 금액을
              맞춥니다. 쿼터·하프·더블은 콜 금액에 현재 판돈의 1/4·1/2·2배를 더
              냅니다. 버튼에 표시된 숫자가 실제로 낼 금액입니다.
            </p>
            <p>
              판돈 1,200칩에 콜 200칩이 필요하다면 쿼터는 500칩, 하프는 800칩,
              더블은 2,600칩입니다. 다이하면 이미 낸 칩은 돌려받지 못합니다.
            </p>
          </section>
          <section id="settlement" className="rules-section text-section">
            <h2>정산과 땡값</h2>
            <p>
              같은 족보로 이기면 판돈을 나눠 갖습니다. 올인 금액이 다르면 팟을
              나누고, 각자 참여한 팟에서만 승부합니다.
            </p>
            <p>
              광땡은 받은 판돈의 5%, 장땡은 1%를 같은 팟에서 끝까지 대결한
              상대에게 땡값으로 받습니다. 상대에게 남은 칩보다 많이 받을 수는
              없습니다.
            </p>
          </section>
          <div className="guide-callout">
            <span>플레이 방법이 궁금하다면</span>
            <Link className="paper-button primary" href="/guide">
              가이드 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
