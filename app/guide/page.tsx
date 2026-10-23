import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "섯다 플레이 가이드",
  description:
    "방 만들기와 친구 초대, 족보 읽기, 첫 베팅까지. 온라인 섯다를 시작하는 데 필요한 세 가지 안내입니다.",
  alternates: { canonical: "https://seotda.felnut.com/guide" },
};

export default function GuidePage() {
  return (
    <>
      <main className="guide-page ornament-corners">
        <p className="breadcrumb">
          <Link href="/">홈</Link>
          <span>/</span>가이드
        </p>
        <h1 className="page-title">한 판에 필요한 것만.</h1>
        <p className="page-description">
          시작부터 첫 베팅까지, 차근차근 알아보세요.
        </p>
        <div className="guide-accordions">
          <details open id="start">
            <summary>
              <span className="guide-number">01</span>
              <span>
                <h2>처음 시작하기</h2>
                <p>방을 만들고, 친구를 초대하고, 함께 시작해요.</p>
              </span>
              <span className="disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="guide-body">
              <ol className="onboarding-steps">
                <li>
                  <span className="step-number">1</span>
                  <div>
                    <h3>방 만들기</h3>
                    <p>홈에서 닉네임과 방 이름을 입력하세요.</p>
                    <div className="guide-example">
                      우리들의 섯다 <small>방 이름 예시</small>
                    </div>
                  </div>
                </li>
                <li>
                  <span className="step-number">2</span>
                  <div>
                    <h3>초대 링크 공유</h3>
                    <p>방의 ‘초대 링크’ 버튼으로 주소를 복사하세요.</p>
                    <div className="guide-example">
                      친구에게 링크 보내기 <span aria-hidden="true">↗</span>
                    </div>
                  </div>
                </li>
                <li>
                  <span className="step-number">3</span>
                  <div>
                    <h3>준비 후 시작</h3>
                    <p>참가자가 준비하면 방장이 시작합니다.</p>
                    <div className="guide-example">
                      참가자 준비 <span className="ready-label">준비</span>
                    </div>
                  </div>
                </li>
              </ol>
              <p className="guide-bottom-note">
                혼자라면 홈의 ‘AI와 연습하기’로 바로 시작할 수 있어요. 로그인은
                선택입니다.
              </p>
            </div>
          </details>
          <details id="hands">
            <summary>
              <span className="guide-number">02</span>
              <span>
                <h2>족보 읽는 법</h2>
                <p>두 장의 조합과 특수 족보를 확인하세요.</p>
              </span>
              <span className="disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="guide-body text-section">
              <p>
                같은 월 두 장은 땡입니다. 광 카드 두 장은 광땡이고, 이름이 붙은
                조합이 아니면 월을 더한 끝자리로 끗을 셉니다.
              </p>
              <p>
                이곳에서는 카드 세 장 중 두 장을 골라 족보를 만듭니다. 게임
                화면에 가능한 조합이 표시되고, ‘족보’ 버튼으로 순위표를 볼 수
                있습니다.
              </p>
              <Link className="text-link" href="/rules">
                카드 그림으로 족보 확인하기 →
              </Link>
            </div>
          </details>
          <details id="betting">
            <summary>
              <span className="guide-number">03</span>
              <span>
                <h2>베팅하는 법</h2>
                <p>체크와 콜, 하프와 쿼터의 차이를 알아보세요.</p>
              </span>
              <span className="disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="guide-body text-section">
              <p>
                체크는 추가로 칩을 내지 않고 차례를 넘기는 행동입니다. 상대가
                베팅했다면 콜로 금액을 맞추거나 다이로 이번 판에서 빠질 수
                있습니다.
              </p>
              <p>
                쿼터·하프·더블은 콜 금액에 현재 판돈의 1/4·1/2·2배를 더 냅니다.
                버튼에 실제로 낼 금액이 표시되니, 남은 칩과 함께 확인하세요.
              </p>
              <p>
                올인은 남은 칩을 전부 겁니다. 칩은 게임 안에서만 사용하며
                현금으로 바꿀 수 없습니다.
              </p>
              <Link className="text-link" href="/rules#betting">
                금액 계산과 정산 규칙 →
              </Link>
            </div>
          </details>
        </div>
        <div className="guide-ending">
          <Link className="text-link" href="/rules">
            족보표 확인하기 →
          </Link>
          <Link className="paper-button primary" href="/?practice=1">
            AI와 연습 시작하기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
