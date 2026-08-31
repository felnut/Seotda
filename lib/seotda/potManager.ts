import { GWANGDDAENG_FEE_RATE, JANGDDAENG_FEE_RATE } from "./constants";
import { HandResult } from "./ranking";
import { Player } from "./types";
import { Pot } from "@/types/seotda";

/**
 * 이번 판에 각 플레이어가 낸 총액(앤티 + 베팅)을 기준으로 메인 팟과
 * 사이드 팟을 나눈다. 보유 칩이 달라 올인 시점이 서로 다르면 여러 팟으로
 * 갈라지고, 다이한 플레이어의 몫도(이미 낸 돈이므로) 금액에는 포함하되
 * eligiblePlayerIds에서는 제외한다.
 *
 * 예: A=1,000 / B=600 / C=300 세 명 모두 올인
 *   → 메인 팟 300×3=900(전원 참가), 사이드 팟 600-300=300×2=600(A,B만),
 *     A의 초과분 1,000-600=400은 경쟁 상대가 없어 A 혼자만의 팟이 되어
 *     자동으로 A에게 돌아간다.
 */
export function buildPots(players: Player[]): Pot[] {
  const contributors = players
    .map((player) => ({
      player,
      contribution: player.anteHandPaid + player.totalBet,
    }))
    .filter((entry) => entry.contribution > 0);

  const levels = Array.from(
    new Set(contributors.map((entry) => entry.contribution)),
  ).sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const layer = contributors.filter((entry) => entry.contribution >= level);
    const amount = (level - previousLevel) * layer.length;

    if (amount > 0) {
      pots.push({
        amount,
        eligiblePlayerIds: layer
          .filter((entry) => entry.player.status !== "folded")
          .map((entry) => entry.player.id),
      });
    }

    previousLevel = level;
  }

  return pots;
}

/**
 * 땡값
 *
 * 광땡(13/18/38광땡) 또는 장땡으로 그 팟을 이겼다면, 같은 팟에 낼 자격이
 * 있던(=다이하지 않은) 상대 각자에게서 그 팟 금액의 일정 비율을 추가로
 * 받는다. 메인 팟과 사이드 팟을 모두 이겼다면 각 팟마다 그 팟의 금액을
 * 기준으로 독립적으로 계산한다 — 자신이 참여하지 않은(예: 자신보다 큰)
 * 팟의 참가자에게는 징수하지 않는다.
 */
export function collectDdaengFeeForPot(
  winner: Player,
  winnerResult: HandResult,
  pot: Pot,
  players: Player[],
): void {
  const isGwangddaeng =
    winnerResult.name === "13광땡" ||
    winnerResult.name === "18광땡" ||
    winnerResult.name === "38광땡";
  const isJangddaeng = winnerResult.name === "장땡";

  if (!isGwangddaeng && !isJangddaeng) return;

  const rate = isGwangddaeng ? GWANGDDAENG_FEE_RATE : JANGDDAENG_FEE_RATE;
  const fee = Math.floor(pot.amount * rate);

  if (fee <= 0) return;

  for (const opponentId of pot.eligiblePlayerIds) {
    if (opponentId === winner.id) continue;

    const opponent = players.find((player) => player.id === opponentId);

    if (!opponent) continue;

    const paid = Math.min(fee, opponent.chips);

    opponent.chips -= paid;
    winner.chips += paid;
  }
}
