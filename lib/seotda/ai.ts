import { RAISE_RATIOS, RaiseRatio } from "./bettingRound";
import { CARDS } from "./cards";
import {
  bestHandFromThree,
  compareHandResults,
  evaluateHand,
  findPrioritySpecialWinner,
  HAND_RANK,
  HandResult,
} from "./ranking";
import { Player } from "./types";
import { SeotdaCard } from "@/types/seotda";

// 혼자 하기(vs AI) 전용 의사결정 로직. 서버의 진짜 승부 판정(ranking.ts)에는
// 관여하지 않고, AI 플레이어가 매 순간 무엇을 할지만 결정한다.
//
// 외부 API 없이 전부 직접 계산한다. 덱이 20장뿐이라, 내가 볼 수 있는
// 카드(내 카드 + 상대가 공개한 카드)를 뺀 나머지에서 상대의 패를 무작위로
// 여러 번 나눠 보며 "지금 이 패로 이길 확률(승률)"을 구하고, 그 승률을
// 콜에 필요한 값(팟 오즈)과 비교해 콜/레이즈/다이를 정한다.

export type BettingAction =
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; ratio: RaiseRatio }
  | { type: "allIn" }
  | { type: "fold" };

export type AiLevel = "easy" | "normal" | "hard";

export const AI_LEVELS: AiLevel[] = ["easy", "normal", "hard"];

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

interface Profile {
  // 승률을 구할 때 시뮬레이션하는 횟수 — 많을수록 정확하다.
  samples: number;
  // 승률에 섞는 무작위 오차(±). 클수록 판단이 흔들린다.
  noise: number;
  // 콜에 필요한 승률에 더하는 값. 음수면 필요 이상으로 자주 콜한다.
  margin: number;
  // 상대가 큰 베팅을 걸어올수록 그 패를 더 강하게 의심하는 정도(0~1).
  respect: number;
  // 한 판(핸드) 단위로 굴려 유지하는 블러핑 / 슬로우플레이 확률.
  bluff: number;
  slowplay: number;
}

const PROFILES: Record<AiLevel, Profile> = {
  easy: {
    samples: 12,
    noise: 0.3,
    margin: -0.1,
    respect: 0,
    bluff: 0.06,
    slowplay: 0,
  },
  normal: {
    samples: 60,
    noise: 0.2,
    margin: -0.04,
    respect: 0.3,
    bluff: 0.1,
    slowplay: 0.06,
  },
  hard: {
    samples: 900,
    noise: 0,
    margin: 0.02,
    respect: 1,
    bluff: 0.12,
    slowplay: 0.1,
  },
};

// ---------------------------------------------------------------- 승률 계산

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

const RANK_GUSA_THRESHOLD = HAND_RANK.ALI;
const RANK_MEONG_GUSA_THRESHOLD = HAND_RANK.NINE_DDAENG;

// 한 번의 가상 대결에서 내 몫(1=승, 0=패, 0.5=무승부/재경기, 공동 우승은 균등
// 분배)을 구한다. 땡잡이·암행어사·구사류 규칙은 실제 판정과 같이 적용한다.
export function showdownShare(
  mine: HandResult,
  others: HandResult[],
): number {
  const results = new Map<string, HandResult>([["me", mine]]);

  others.forEach((result, index) => results.set(`o${index}`, result));

  // 구사/멍텅구리 구사: 다른 참가자 중 기준을 넘는 패가 없으면 재경기(무승부).
  for (const result of results.values()) {
    if (result.special !== "gusa" && result.special !== "meongtunguri-gusa") {
      continue;
    }

    const threshold =
      result.special === "gusa"
        ? RANK_GUSA_THRESHOLD
        : RANK_MEONG_GUSA_THRESHOLD;

    const someoneAbove = [...results.values()].some(
      (other) => other !== result && other.rank > threshold,
    );

    if (!someoneAbove) return 0.5;
  }

  const ids = [...results.keys()];
  const priority = findPrioritySpecialWinner(ids, results);

  if (priority) return priority === "me" ? 1 : 0;

  let best = mine;
  let tied = 1;

  for (const other of others) {
    const cmp = compareHandResults(other, best);

    if (cmp > 0) {
      best = other;
      tied = 1;
    } else if (cmp === 0) {
      tied += 1;
    }
  }

  if (compareHandResults(mine, best) < 0) return 0;

  return 1 / tied;
}

export interface EquityInput {
  myCards: SeotdaCard[];
  // 아직 다이하지 않고 나와 승부할 상대들의 "공개된 카드"(없으면 null).
  opponentRevealed: (SeotdaCard | null)[];
  // 이미 공개돼 더 이상 나올 수 없는 카드들(다이한 사람이 공개한 것 포함).
  otherKnownCards: SeotdaCard[];
}

// 지금 볼 수 있는 정보만으로 이길 확률(0~1)을 몬테카를로로 추정한다.
// 숨겨진 카드(상대의 비공개 카드, 앞으로 받을 세 번째 카드)는 아직 보이지
// 않는 카드 중에서 무작위로 나눈다.
export function estimateEquity(
  input: EquityInput,
  samples: number,
  rng: () => number = Math.random,
): number {
  const known = new Set<string>([
    ...input.myCards.map((card) => card.id),
    ...input.otherKnownCards.map((card) => card.id),
  ]);

  for (const card of input.opponentRevealed) {
    if (card) known.add(card.id);
  }

  const pool = CARDS.filter((card) => !known.has(card.id));
  const myNeeded = Math.max(0, 3 - input.myCards.length);
  const needs = input.opponentRevealed.map((card) => (card ? 2 : 3));
  const totalNeeded = myNeeded + needs.reduce((sum, n) => sum + n, 0);

  // 이론상 생기지 않지만, 카드가 모자라면 계산을 포기하고 중간값을 돌려준다.
  if (totalNeeded > pool.length) return 0.5;

  let total = 0;

  for (let s = 0; s < samples; s++) {
    const deal = shuffle(pool, rng);
    let cursor = 0;

    const mineFull = [...input.myCards];

    for (let i = 0; i < myNeeded; i++) mineFull.push(deal[cursor++]);

    const mine = bestOf(mineFull);
    const others = input.opponentRevealed.map((revealed, index) => {
      const hand: SeotdaCard[] = revealed ? [revealed] : [];

      for (let i = 0; i < needs[index]; i++) hand.push(deal[cursor++]);

      return bestOf(hand);
    });

    total += showdownShare(mine, others);
  }

  return total / samples;
}

function bestOf(cards: SeotdaCard[]): HandResult {
  return cards.length >= 3
    ? bestHandFromThree(
        cards.slice(0, 3) as [SeotdaCard, SeotdaCard, SeotdaCard],
      ).result
    : evaluateHand([cards[0], cards[1]]);
}

// ---------------------------------------------------------------- 의사결정

export interface BettingContext {
  player: Player;
  // 방의 모든 플레이어(내 자신 포함) — 상대의 공개 카드와 생존 여부를 본다.
  players: Player[];
  pot: number;
  currentBet: number;
  level?: AiLevel;
  rng?: () => number;
}

// 같은 판(내 처음 두 장)이면 항상 같은 값이 나오는 0~1 난수. 블러핑·슬로우
// 플레이 여부를 매 판단마다 다시 굴리면 한 판 안에서 행동이 오락가락하므로,
// 판 단위로 한 번만 정해지도록 카드로 값을 만든다.
function handSeed(player: Player): number {
  const key =
    player.id + (player.cards ?? []).slice(0, 2).map((c) => c.id).join(",");
  let hash = 2166136261;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}

// 내 승률과 상관없이 상대가 큰 베팅을 걸면 그만큼 강한 패일 가능성이 높으므로,
// 베팅 크기(팟 대비 콜 금액)에 비례해 필요한 승률을 올린다.
const RESPECT_WEIGHT = 0.14;

export function decideBettingAction(ctx: BettingContext): BettingAction {
  const { player, players, pot, currentBet } = ctx;
  const profile = PROFILES[ctx.level ?? "normal"];
  const rng = ctx.rng ?? Math.random;

  if (!player.cards) return { type: "fold" };

  const opponents = players.filter(
    (p) => p.id !== player.id && p.status === "playing" && !p.isSpectator,
  );

  const equityRaw = estimateEquity(
    {
      myCards: player.cards,
      opponentRevealed: opponents.map((p) =>
        p.cards && p.revealedCardIndex !== null
          ? (p.cards[p.revealedCardIndex] ?? null)
          : null,
      ),
      otherKnownCards: players
        .filter(
          (p) =>
            p.id !== player.id &&
            p.status !== "playing" &&
            p.cards &&
            p.revealedCardIndex !== null,
        )
        .map((p) => p.cards![p.revealedCardIndex!]),
    },
    profile.samples,
    rng,
  );

  const seed = handSeed(player);
  const isBluffing =
    seed < profile.bluff && opponents.length <= 2 && equityRaw < 0.45;
  const isSlowPlaying =
    seed > 1 - profile.slowplay && equityRaw > 0.8 && opponents.length >= 1;

  let equity = equityRaw + (rng() - 0.5) * 2 * profile.noise;

  // 허세: 실제 승률이 낮아도 한 판 내내 강한 척 행동한다(상대가 적을 때만).
  if (isBluffing) equity = Math.max(equity, 0.75);

  equity = Math.min(1, Math.max(0, equity));

  const toCall = currentBet - player.bet;
  const remainingCap = player.maxBet - player.totalBet;
  const canCheck = toCall <= 0;
  const canCall =
    toCall > 0 && toCall <= player.chips && toCall <= remainingCap;
  const canAllIn = player.chips > 0;

  const raiseCost = (ratio: RaiseRatio) => {
    const size = Math.floor(pot * RAISE_RATIOS[ratio]);

    return size <= 0 ? -1 : currentBet + size - player.bet;
  };

  const canRaise = (ratio: RaiseRatio) => {
    const cost = raiseCost(ratio);

    return cost > 0 && cost <= player.chips && cost <= remainingCap;
  };

  // 원하는 크기가 안 되면 한 단계씩 작은 레이즈로 내려간다. 다 안 되면 null.
  const pickRaise = (want: RaiseRatio): RaiseRatio | null => {
    const order: RaiseRatio[] = ["double", "half", "quarter"];
    const start = order.indexOf(want);

    for (let i = start; i < order.length; i++) {
      if (canRaise(order[i])) return order[i];
    }

    return null;
  };

  // ---- 베팅이 없을 때: 체크하거나 판을 키운다.
  if (canCheck) {
    if (isSlowPlaying) return { type: "check" };

    let want: RaiseRatio | null = null;

    if (equity > 0.88) want = "double";
    else if (equity > 0.68) want = "half";
    else if (equity > 0.52 && rng() < 0.5) want = "quarter";

    if (want) {
      const ratio = pickRaise(want);

      if (ratio) return { type: "raise", ratio };
    }

    return { type: "check" };
  }

  // ---- 상대가 베팅했을 때: 팟 오즈와 승률을 비교한다.
  const payable = Math.min(toCall, player.chips);
  const potOdds = payable / (pot + payable);
  const pressure = Math.min(1, toCall / Math.max(pot, 1));
  const needed =
    potOdds + profile.margin + profile.respect * RESPECT_WEIGHT * pressure;

  if (!canCall) {
    // 칩이 모자라거나 한도에 걸려 정상 콜이 안 된다 — 올인이 값어치가 있을
    // 때만 있는 만큼 건다.
    if (canAllIn && equity > needed + (toCall <= player.chips ? 0.1 : 0)) {
      return { type: "allIn" };
    }

    return { type: "fold" };
  }

  if (equity < needed) {
    return { type: "fold" };
  }

  if (isSlowPlaying) return { type: "call" };

  // 필요한 승률을 한참 넘길 만큼 강하면 판을 키운다.
  if (equity > 0.88 && equity > needed + 0.25) {
    const ratio = pickRaise(rng() < 0.6 ? "double" : "half");

    if (ratio) return { type: "raise", ratio };
  }

  if (equity > 0.7 && equity > needed + 0.15) {
    const ratio = pickRaise("half");

    if (ratio) return { type: "raise", ratio };
  }

  return { type: "call" };
}

// ---------------------------------------------------------------- 그 밖의 선택

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
