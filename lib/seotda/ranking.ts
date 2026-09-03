import { SeotdaCard } from "@/types/seotda";

export const HAND_RANK = {
  MANGTONG: 0,

  KKEUT_1: 1,
  KKEUT_2: 2,
  KKEUT_3: 3,
  KKEUT_4: 4,
  KKEUT_5: 5,
  KKEUT_6: 6,
  KKEUT_7: 7,
  KKEUT_8: 8,
  GAP_OH: 9,

  SAEYUK: 10,
  JANGSA: 11,
  JANGPPING: 12,
  GUPPING: 13,
  DOKSA: 14,
  ALI: 15,

  ONE_DDAENG: 16,
  TWO_DDAENG: 17,
  THREE_DDAENG: 18,
  FOUR_DDAENG: 19,
  FIVE_DDAENG: 20,
  SIX_DDAENG: 21,
  SEVEN_DDAENG: 22,
  EIGHT_DDAENG: 23,
  NINE_DDAENG: 24,
  JANG_DDAENG: 25,

  IL_SAM_GWANGDDAENG: 26,
  IL_PAL_GWANGDDAENG: 27,
  SAM_PAL_GWANGDDAENG: 28,
} as const;

export type HandRank = (typeof HAND_RANK)[keyof typeof HAND_RANK];

export type HandName =
  | "망통"
  | "1끗"
  | "2끗"
  | "3끗"
  | "4끗"
  | "5끗"
  | "6끗"
  | "7끗"
  | "8끗"
  | "갑오(아홉끗)"
  | "세륙"
  | "장사"
  | "장삥"
  | "구삥"
  | "독사"
  | "알리"
  | "1땡"
  | "2땡"
  | "3땡"
  | "4땡"
  | "5땡"
  | "6땡"
  | "7땡"
  | "8땡"
  | "9땡"
  | "장땡"
  | "13광땡"
  | "18광땡"
  | "38광땡";

export type SpecialHand =
  | "none"
  | "gusa"
  | "meongtunguri-gusa"
  | "ddaengjabi"
  | "amhaeng-eosa";

export interface HandResult {
  name: HandName;
  rank: HandRank;
  value: number;
  special: SpecialHand;
}

// 구사류 특수 족보는 evaluateHand()의 name이 항상 "망통"으로 나오므로,
// 화면에 보여줄 실제 이름은 이 매핑을 거쳐야 한다.
export const SPECIAL_HAND_DISPLAY_NAME: Record<
  Exclude<SpecialHand, "none">,
  string
> = {
  gusa: "구사",
  "meongtunguri-gusa": "멍텅구리 구사",
  ddaengjabi: "땡잡이",
  "amhaeng-eosa": "암행어사",
};

// 화면에 보여줄 족보 이름 — 구사류면 특수 족보 이름을, 아니면 일반 족보 이름을 반환한다.
export function getDisplayHandName(result: HandResult): string {
  return result.special === "none"
    ? result.name
    : SPECIAL_HAND_DISPLAY_NAME[result.special];
}

//두 카드의 월을 오름차순으로 반환
function getMonths(cards: [SeotdaCard, SeotdaCard]): [number, number] {
  const [card1, card2] = cards;

  if (!card1 || !card2) {
    throw new Error("카드가 2장 필요합니다.");
  }

  return card1.month <= card2.month
    ? [card1.month, card2.month]
    : [card2.month, card1.month];
}

//특수족보 판정
function getSpecialHand(cards: [SeotdaCard, SeotdaCard]): SpecialHand {
  const [card1, card2] = cards;
  const [a, b] = getMonths(cards);

  //멍구사
  if (a === 4 && b === 9 && card1.type === "ten" && card2.type === "ten") {
    return "meongtunguri-gusa";
  }

  //구사
  if (a === 4 && b === 9) {
    return "gusa";
  }

  //땡잡이
  if (
    a === 3 &&
    b === 7 &&
    ((card1.month === 3 &&
      card1.type === "light" &&
      card2.month === 7 &&
      card2.type === "ten") ||
      (card1.month === 7 &&
        card1.type === "ten" &&
        card2.month === 3 &&
        card2.type === "light"))
  ) {
    return "ddaengjabi";
  }

  //암행어사
  if (a === 4 && b === 7 && card1.type === "ten" && card2.type === "ten") {
    return "amhaeng-eosa";
  }

  return "none";
}

export function evaluateHand(cards: [SeotdaCard, SeotdaCard]): HandResult {
  const [card1, card2] = cards;
  const [a, b] = getMonths(cards);

  //특수 족보
  //특수 족보는 일반 족보보다 먼저 확인한다.
  const special = getSpecialHand(cards);

  //구사 / 멍텅구리 구사는 일반 족보로 판정하지 않고 특수 효과만 기록
  //실제 재경기 여부는 게임 진행 단계에서 처리한다.
  if (special === "gusa" || special === "meongtunguri-gusa") {
    return {
      name: "망통",
      rank: HAND_RANK.MANGTONG,
      value: 0,
      special,
    };
  }

  //땡잡이
  //일반적인 족보 순위에 넣지 않고 compareHands()에서 특정 땡을 잡는 효과로 처리
  if (special === "ddaengjabi") {
    return {
      name: "망통",
      rank: HAND_RANK.MANGTONG,
      value: 0,
      special,
    };
  }

  //암행어사
  //13/18광땡을 잡지 못하면(타깃패가 없으면) 한끗으로 취급한다.
  if (special === "amhaeng-eosa") {
    return {
      name: "1끗",
      rank: HAND_RANK.KKEUT_1,
      value: 1,
      special,
    };
  }

  //광땡
  if (card1.type === "light" && card2.type === "light") {
    if (a === 3 && b === 8) {
      return {
        name: "38광땡",
        rank: HAND_RANK.SAM_PAL_GWANGDDAENG,
        value: 38,
        special: "none",
      };
    }

    if (a === 1 && b === 8) {
      return {
        name: "18광땡",
        rank: HAND_RANK.IL_PAL_GWANGDDAENG,
        value: 18,
        special: "none",
      };
    }

    if (a === 1 && b === 3) {
      return {
        name: "13광땡",
        rank: HAND_RANK.IL_SAM_GWANGDDAENG,
        value: 13,
        special: "none",
      };
    }
  }

  //땡
  if (a === b) {
    const ddaeng: Record<number, { name: HandName; rank: HandRank }> = {
      1: {
        name: "1땡",
        rank: HAND_RANK.ONE_DDAENG,
      },
      2: {
        name: "2땡",
        rank: HAND_RANK.TWO_DDAENG,
      },
      3: {
        name: "3땡",
        rank: HAND_RANK.THREE_DDAENG,
      },
      4: {
        name: "4땡",
        rank: HAND_RANK.FOUR_DDAENG,
      },
      5: {
        name: "5땡",
        rank: HAND_RANK.FIVE_DDAENG,
      },
      6: {
        name: "6땡",
        rank: HAND_RANK.SIX_DDAENG,
      },
      7: {
        name: "7땡",
        rank: HAND_RANK.SEVEN_DDAENG,
      },
      8: {
        name: "8땡",
        rank: HAND_RANK.EIGHT_DDAENG,
      },
      9: {
        name: "9땡",
        rank: HAND_RANK.NINE_DDAENG,
      },
      10: {
        name: "장땡",
        rank: HAND_RANK.JANG_DDAENG,
      },
    };

    const result = ddaeng[a];

    if (!result) {
      throw new Error(`잘못된 땡 숫자: ${a}`);
    }

    return {
      name: result.name,
      rank: result.rank,
      value: a,
      special: "none",
    };
  }

  //알리
  if (a === 1 && b === 2) {
    return {
      name: "알리",
      rank: HAND_RANK.ALI,
      value: 0,
      special: "none",
    };
  }

  //독사
  if (a === 1 && b === 4) {
    return {
      name: "독사",
      rank: HAND_RANK.DOKSA,
      value: 0,
      special: "none",
    };
  }

  //구삥
  if (a === 1 && b === 9) {
    return {
      name: "구삥",
      rank: HAND_RANK.GUPPING,
      value: 0,
      special: "none",
    };
  }

  //장삥
  if (a === 1 && b === 10) {
    return {
      name: "장삥",
      rank: HAND_RANK.JANGPPING,
      value: 0,
      special: "none",
    };
  }

  //장사
  if (a === 4 && b === 10) {
    return {
      name: "장사",
      rank: HAND_RANK.JANGSA,
      value: 0,
      special: "none",
    };
  }

  //세륙
  if (a === 4 && b === 6) {
    return {
      name: "세륙",
      rank: HAND_RANK.SAEYUK,
      value: 0,
      special: "none",
    };
  }

  //끗
  const kkeut = (a + b) % 10;
  const kkeutRanks: Record<number, HandRank> = {
    1: HAND_RANK.KKEUT_1,
    2: HAND_RANK.KKEUT_2,
    3: HAND_RANK.KKEUT_3,
    4: HAND_RANK.KKEUT_4,
    5: HAND_RANK.KKEUT_5,
    6: HAND_RANK.KKEUT_6,
    7: HAND_RANK.KKEUT_7,
    8: HAND_RANK.KKEUT_8,
  };

  if (kkeut === 9) {
    return {
      name: "갑오(아홉끗)",
      rank: HAND_RANK.GAP_OH,
      value: 9,
      special: "none",
    };
  }

  if (kkeut > 0) {
    const rank = kkeutRanks[kkeut];

    if (!rank) {
      throw new Error(`잘못된 끗 값: ${kkeut}`);
    }

    return {
      name: `${kkeut}끗` as HandName,
      rank,
      value: kkeut,
      special: "none",
    };
  }

  //망통
  return {
    name: "망통",
    rank: HAND_RANK.MANGTONG,
    value: 0,
    special: "none",
  };
}

// 3장 중 최종 족보로 쓸 가장 좋은 2장을 고른다. 다이로 이겨 스스로 족보를
// 고르지 못한 승자를 표시용으로 확정할 때(game.ts)와, 혼자 하기 AI가 항상
// 최선의 조합을 쓰도록 할 때(ai.ts) 공통으로 쓰인다.
export function bestHandFromThree(
  cards: [SeotdaCard, SeotdaCard, SeotdaCard],
): { indices: [number, number]; result: HandResult } {
  const pairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  let best = pairs[0];
  let bestResult = evaluateHand([cards[best[0]], cards[best[1]]]);

  for (let i = 1; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const result = evaluateHand([cards[a], cards[b]]);

    if (compareHandResults(result, bestResult) > 0) {
      best = pairs[i];
      bestResult = result;
    }
  }

  return { indices: best, result: bestResult };
}

export type CompareResult = -1 | 0 | 1;

//특정 땡을 땡잡이가 잡을 수 있는지 확인
function isDdaengJabiWin(opponent: HandResult): boolean {
  return (
    opponent.name === "1땡" ||
    opponent.name === "2땡" ||
    opponent.name === "3땡" ||
    opponent.name === "4땡" ||
    opponent.name === "5땡" ||
    opponent.name === "6땡" ||
    opponent.name === "7땡" ||
    opponent.name === "8땡" ||
    opponent.name === "9땡"
  );
}

//암행어사가 광땡을 잡을 수 있는지 확인
function isAmhaengEosaWin(opponent: HandResult): boolean {
  return opponent.name === "13광땡" || opponent.name === "18광땡";
}

// 3명 이상이 한 팟에서 맞붙으면, 땡잡이·암행어사의 "특정 패를 잡는다"는
// 효과를 일반 족보 순위와 함께 pairwise 비교로 섞어서는 안 된다 — A가
// 암행어사(1끗 취급)로 B(장땡급 다른 참가자)에게 순위상 밀리고, B는
// C(땡잡이 타깃인 땡)에게 지고, C의 땡은 다시 암행어사 A에게 잡히는 식의
// 순환이 만들어질 수 있기 때문이다(17.1). 그래서 승자를 정할 때는 항상
// 이 함수를 먼저 써서 "지금 이 무리 안에 발동 조건을 만족하는 특수족보
// 소지자가 있는지"부터 확인하고, 있으면 그 소지자를 즉시 승자로 확정한다.
// 우선순위는 15장/17장 판정 순서(암행어사 → 땡잡이)를 따른다.
//
// 구사·멍텅구리 구사는 재경기 여부가 이 시점 이전(게임 진행 단계)에 이미
// 확정된다 — 재경기가 발동했다면 애초에 승자를 가릴 필요가 없고, 재경기가
// 무산됐다면 그 즉시 일반 폴백 순위(망통)로 취급되므로 여기서 다시
// 확인할 필요가 없다.
export function findPrioritySpecialWinner(
  contenderIds: string[],
  results: Map<string, HandResult>,
): string | null {
  const checks: {
    special: Extract<SpecialHand, "amhaeng-eosa" | "ddaengjabi">;
    beats: (opponent: HandResult) => boolean;
  }[] = [
    { special: "amhaeng-eosa", beats: isAmhaengEosaWin },
    { special: "ddaengjabi", beats: isDdaengJabiWin },
  ];

  for (const { special, beats } of checks) {
    const holderId = contenderIds.find(
      (id) => results.get(id)?.special === special,
    );

    if (!holderId) continue;

    const hasTarget = contenderIds.some(
      (id) => id !== holderId && beats(results.get(id)!),
    );

    if (hasTarget) return holderId;
  }

  return null;
}

// 이미 evaluateHand()로 계산해둔 결과 두 개를 비교한다. 사이드 팟처럼 같은
// results Map을 여러 팟에 걸쳐 재사용해야 할 때, 카드 쌍을 다시 넘겨 매번
// evaluateHand를 반복 호출하지 않도록 compareHands에서 이 부분만 분리했다.
//
// 순수하게 일반 족보 순위(rank/value)만 비교한다 — 항상 이행적(transitive)
// 이라 몇 명이 얽히든 안전하게 반복 비교할 수 있다. 땡잡이·암행어사처럼
// 특정 상대만 이기는 효과는 findPrioritySpecialWinner()가 먼저 처리하고,
// 그 효과가 발동하지 않을 때만 이 함수가 폴백으로 쓰인다.
export function compareHandResults(
  result1: HandResult,
  result2: HandResult,
): CompareResult {
  if (result1.rank > result2.rank) {
    return 1;
  }

  if (result1.rank < result2.rank) {
    return -1;
  }

  if (result1.value > result2.value) {
    return 1;
  }

  if (result1.value < result2.value) {
    return -1;
  }

  return 0;
}

export function compareHands(
  hand1: [SeotdaCard, SeotdaCard],
  hand2: [SeotdaCard, SeotdaCard],
): CompareResult {
  return compareHandResults(evaluateHand(hand1), evaluateHand(hand2));
}
