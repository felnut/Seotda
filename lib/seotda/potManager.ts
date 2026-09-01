import { GWANGDDAENG_FEE_RATE, JANGDDAENG_FEE_RATE } from "./constants";
import {
  compareHandResults,
  findPrioritySpecialWinner,
  HandResult,
} from "./ranking";
import { Player } from "./types";

// 사이드 팟 하나 — amount는 이 팟의 총액, eligiblePlayerIds는 이 팟을
// 받을 자격이 있는(=이 팟 금액까지 낸, 다이하지 않은) 플레이어 id 목록이다.
export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

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
 *
 * 한 구간(층)에 낸 사람 전원이 다이해버리면(=아무도 그 몫을 두고 겨루지
 * 않는 "받아줄 상대 없는" 초과분) 그 구간은 팟에 넣지 않고 낸 사람에게
 * 그대로 돌려준다 — 안 그러면 아무에게도 지급되지 않는 채로 칩이
 * 증발한다. 예: A가 크게 레이즈해 혼자만 5,817까지 냈는데 이후 A가
 * 다이하면, 다른 누구도 그 구간(2,649~5,817)에 낸 적이 없으므로 그 차액
 * 3,168은 A에게 환불된다.
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
    const layerAmountPerPlayer = level - previousLevel;
    const amount = layerAmountPerPlayer * layer.length;

    if (amount > 0) {
      const eligible = layer.filter(
        (entry) => entry.player.status !== "folded",
      );

      if (eligible.length === 0) {
        for (const entry of layer) {
          entry.player.chips += layerAmountPerPlayer;
        }
      } else {
        pots.push({
          amount,
          eligiblePlayerIds: eligible.map((entry) => entry.player.id),
        });
      }
    }

    previousLevel = level;
  }

  return pots;
}

/**
 * 같은 순위(공동 순위 포함)끼리 묶어 1등 그룹부터 내림차순으로 정렬한다.
 */
export function groupByRank(
  players: Player[],
  results: Map<string, HandResult>,
): Player[][] {
  const sorted = [...players].sort((a, b) =>
    compareHandResults(results.get(b.id)!, results.get(a.id)!),
  );

  const groups: Player[][] = [];

  for (const player of sorted) {
    const lastGroup = groups[groups.length - 1];
    const sameRankAsLastGroup =
      lastGroup &&
      compareHandResults(
        results.get(lastGroup[0].id)!,
        results.get(player.id)!,
      ) === 0;

    if (sameRankAsLastGroup) {
      lastGroup.push(player);
    } else {
      groups.push([player]);
    }
  }

  return groups;
}

/**
 * 팟 하나를 그 팟의 참가자(eligiblePlayerIds) 범위 안에서 승자(들)에게
 * 나눈다. 땡잡이·암행어사처럼 특정 패를 잡는 효과가 이 팟 참가자 범위
 * 안에서 발동하는지 먼저 확인해(17.1) 발동하면 그 소지자가 팟 전체를
 * 단독으로 가져가며, 발동하지 않을 때만 일반 순위로 비교해 최고 순위
 * 그룹(공동 순위 포함)에게 균등하게 나눈다(나눗셈 나머지는 앞사람부터
 * 1씩 더 받는다).
 */
export function distributePot(
  pot: Pot,
  results: Map<string, HandResult>,
  players: Player[],
): Map<string, number> {
  const payouts = new Map<string, number>();

  if (pot.eligiblePlayerIds.length === 0) return payouts;

  const priorityWinnerId = findPrioritySpecialWinner(
    pot.eligiblePlayerIds,
    results,
  );

  const eligiblePlayers = pot.eligiblePlayerIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => player !== undefined);

  const winners = priorityWinnerId
    ? eligiblePlayers.filter((player) => player.id === priorityWinnerId)
    : (groupByRank(eligiblePlayers, results)[0] ?? []);

  if (winners.length === 0) return payouts;

  const share = Math.floor(pot.amount / winners.length);
  let remainder = pot.amount - share * winners.length;

  for (const winner of winners) {
    const extra = remainder > 0 ? 1 : 0;

    if (remainder > 0) remainder--;

    payouts.set(winner.id, share + extra);
  }

  return payouts;
}

/**
 * 땡값 — 광땡/장땡으로 amount(어느 팟에서 받은 금액)를 받았다면, 같은
 * 팟에 낼 자격이 있던(=다이하지 않은) 상대 각자에게서 그 금액 대비
 * 일정 비율을 추가로 받는다.
 */
export function collectDdaengFee(
  winner: Player,
  winnerResult: HandResult,
  amount: number,
  opponentIds: string[],
  players: Player[],
): void {
  const isGwangddaeng =
    winnerResult.name === "13광땡" ||
    winnerResult.name === "18광땡" ||
    winnerResult.name === "38광땡";
  const isJangddaeng = winnerResult.name === "장땡";

  if (!isGwangddaeng && !isJangddaeng) return;

  const rate = isGwangddaeng ? GWANGDDAENG_FEE_RATE : JANGDDAENG_FEE_RATE;
  const fee = Math.floor(amount * rate);

  if (fee <= 0) return;

  for (const opponentId of opponentIds) {
    if (opponentId === winner.id) continue;

    const opponent = players.find((player) => player.id === opponentId);

    if (!opponent) continue;

    const paid = Math.min(fee, opponent.chips);

    opponent.chips -= paid;
    winner.chips += paid;
  }
}
