import { ClientGameState, ClientPlayer } from "@/types/seotda";
import { RAISE_RATIOS, RaiseRatio } from "@/lib/seotda/bettingRound";

// 베팅 버튼(콜/하프/쿼터/더블/올인)을 눌렀을 때 실제로 낼 금액을 미리
// 계산한다. lib/seotda/bettingRound.ts의 call()·raiseByRatio()·allIn()과
// 정확히 같은 공식을 그대로 따라야, 버튼에 보여주는 숫자와 실제로
// 서버에서 빠져나가는 금액이 어긋나지 않는다.
export interface BettingAmounts {
  callAmount: number;
  raiseAmounts: Record<RaiseRatio, number>;
  allInAmount: number;
  // 이번 판(1차+2차 베팅 전체)에 이미 얼마를 걸었고, 개인별 상한(maxBet)까지
  // 얼마가 남았는지. 올인은 이 한도의 유일한 예외다.
  totalBet: number;
  maxBet: number;
  remainingRoom: number;
}

export function computeBettingAmounts(
  pot: number,
  currentBet: number,
  me: Pick<ClientPlayer, "bet" | "chips" | "totalBet" | "maxBet">,
): BettingAmounts {
  const callAmount = Math.max(0, currentBet - me.bet);

  const raiseAmounts = Object.fromEntries(
    (Object.keys(RAISE_RATIOS) as RaiseRatio[]).map((ratio) => {
      const raiseSize = Math.floor(pot * RAISE_RATIOS[ratio]);
      const target = currentBet + raiseSize;

      return [ratio, Math.max(0, target - me.bet)];
    }),
  ) as Record<RaiseRatio, number>;

  return {
    callAmount,
    raiseAmounts,
    allInAmount: me.chips,
    totalBet: me.totalBet,
    maxBet: me.maxBet,
    remainingRoom: Math.max(0, me.maxBet - me.totalBet),
  };
}

export const RAISE_RATIO_LABEL: Record<RaiseRatio, string> = {
  half: "하프",
  quarter: "쿼터",
  double: "더블",
};

// 설정에서 "베팅 전 확인"을 켰을 때, 실제로 낼 금액을 보여주며 한 번 더
// 묻는다. 액션 핸들러(raiseByRatio/allIn)는 렌더 중에 계산해둔
// bettingAmounts가 아니라 이 시점의 gameState를 직접 넘겨받으므로,
// 금액도 여기서 같은 공식(computeBettingAmounts)으로 다시 구한다.
export function confirmBetAmount(
  actionLabel: string,
  gameState: ClientGameState | null,
  playerId: string,
  pickAmount: (amounts: BettingAmounts) => number,
): boolean {
  const me = gameState?.players.find((player) => player.id === playerId);

  if (!gameState || !me) return true;

  const amount = pickAmount(
    computeBettingAmounts(gameState.pot, gameState.currentBet, me),
  );

  return window.confirm(
    `${actionLabel} ${amount.toLocaleString()}을(를) 베팅할까요?`,
  );
}
