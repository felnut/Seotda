import { RAISE_RATIOS, RaiseRatio } from "./bettingRound";
import { bestHandFromThree, evaluateHand, HandResult } from "./ranking";
import { Player } from "./types";
import { SeotdaCard } from "@/types/seotda";

// 혼자 하기(vs AI) 전용 의사결정 로직. 서버의 진짜 승부 판정(ranking.ts)에는
// 관여하지 않고, AI 플레이어가 매 순간 무엇을 할지만 결정한다.

export type BettingAction =
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; ratio: RaiseRatio }
  | { type: "allIn" }
  | { type: "fold" };

// 카드 2장(또는 3장 중 최선의 2장)을 0(최약)~1(최강) 사이 승산으로 정규화한다.
// 구사류·땡잡이·암행어사는 일반 순위표에 없으므로 따로 감안한다.
function estimateStrength(cards: SeotdaCard[]): number {
  const result: HandResult =
    cards.length >= 3
      ? bestHandFromThree(cards.slice(0, 3) as [SeotdaCard, SeotdaCard, SeotdaCard])
          .result
      : evaluateHand([cards[0], cards[1]]);

  switch (result.special) {
    case "gusa":
    case "meongtunguri-gusa":
      // 곧바로 재경기라 이번 패의 승패 자체는 중요치 않다 — 판돈이 그대로
      // 유지된 채 다시 붙을 뿐이므로 중간 정도로만 취급한다.
      return 0.55;
    case "ddaengjabi":
      return 0.5;
    case "amhaeng-eosa":
      // 13/18광땡을 잡을 때만 강하고, 그 외에는 1끗이나 다름없다.
      return 0.35;
    default:
      // rank 0(망통)~28(38광땡)을 0~1로 선형 변환하되 양 끝을 완전히
      // 0/1로 두지 않는다 — 아무리 약해도 블러핑, 아무리 강해도 슬로우
      // 플레이가 섞일 여지를 남긴다.
      return 0.03 + (result.rank / 28) * 0.94;
  }
}

// 순수한 패 강도에 무작위 블러핑/슬로우플레이를 섞는다. 매 판단마다 새로
// 굴려서, 같은 패라도 매번 똑같이 행동하지 않게 한다.
const BLUFF_CHANCE = 0.14;
const BLUFF_BOOST = 0.4;
const SLOWPLAY_CHANCE = 0.08;
const SLOWPLAY_DROP = 0.25;

function effectiveStrength(cards: SeotdaCard[]): number {
  const base = estimateStrength(cards);
  const roll = Math.random();

  if (roll < BLUFF_CHANCE) return Math.min(1, base + BLUFF_BOOST);
  if (roll < BLUFF_CHANCE + SLOWPLAY_CHANCE) {
    return Math.max(0, base - SLOWPLAY_DROP);
  }

  return base;
}

export interface BettingContext {
  player: Player;
  pot: number;
  currentBet: number;
}

export function decideBettingAction(ctx: BettingContext): BettingAction {
  const { player, pot, currentBet } = ctx;

  if (!player.cards) return { type: "fold" };

  const strength = effectiveStrength(player.cards);
  const toCall = currentBet - player.bet;
  const remainingCap = player.maxBet - player.totalBet;

  const canCheck = toCall <= 0;
  const canCall =
    toCall > 0 && toCall <= player.chips && toCall <= remainingCap;
  const canAllIn = player.chips > 0;

  const canRaise = (ratio: RaiseRatio) => {
    const size = Math.floor(pot * RAISE_RATIOS[ratio]);

    if (size <= 0) return false;

    const amountToPay = currentBet + size - player.bet;

    return (
      amountToPay > 0 &&
      amountToPay <= player.chips &&
      amountToPay <= remainingCap
    );
  };

  if (canCheck) {
    if (strength > 0.9 && canRaise("double")) {
      return { type: "raise", ratio: "double" };
    }

    if (strength > 0.72 && canRaise("half")) {
      return { type: "raise", ratio: "half" };
    }

    if (strength > 0.5 && Math.random() < 0.4 && canRaise("quarter")) {
      return { type: "raise", ratio: "quarter" };
    }

    return { type: "check" };
  }

  if (!canCall) {
    // 콜에 필요한 만큼 낼 수 없다 — 웬만큼 패가 좋을 때만 있는 만큼 올인한다.
    if (canAllIn && strength > 0.45) return { type: "allIn" };

    return { type: "fold" };
  }

  if (strength > 0.85 && Math.random() < 0.5 && canRaise("double")) {
    return { type: "raise", ratio: "double" };
  }

  if (strength > 0.68 && canRaise("half")) {
    return { type: "raise", ratio: "half" };
  }

  if (strength > 0.4) {
    return { type: "call" };
  }

  // 가끔 약한 패로도 쿼터레이즈를 던져 블러핑한다.
  if (strength > 0.22 && Math.random() < 0.2 && canRaise("quarter")) {
    return { type: "raise", ratio: "quarter" };
  }

  return { type: "fold" };
}

// 최종 족보에 남길 최선의 2장을 제외한 나머지 한 장을 공개한다.
export function decideRevealIndex(cards: SeotdaCard[]): number {
  const { indices } = bestHandFromThree(
    cards as [SeotdaCard, SeotdaCard, SeotdaCard],
  );
  const kept = new Set(indices);

  return cards.findIndex((_, index) => !kept.has(index));
}

// AI는 항상 3장 중 가장 좋은 족보가 되는 2장을 고른다.
export function decideSelectIndices(cards: SeotdaCard[]): [number, number] {
  return bestHandFromThree(cards as [SeotdaCard, SeotdaCard, SeotdaCard])
    .indices;
}
