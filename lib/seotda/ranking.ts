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
  if (special === "amhaeng-eosa") {
    return {
      name: "망통",
      rank: HAND_RANK.MANGTONG,
      value: 0,
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

export type CompareResult = -1 | 0 | 1;

//특정 땡을 땡잡이가 잡을 수 있는지 확인
function isDdaengJabiWin(special: SpecialHand, opponent: HandResult): boolean {
  if (special !== "ddaengjabi") {
    return false;
  }

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
function isAmhaengEosaWin(special: SpecialHand, opponent: HandResult): boolean {
  if (special !== "amhaeng-eosa") {
    return false;
  }

  return opponent.name === "13광땡" || opponent.name === "18광땡";
}

export function compareHands(
  hand1: [SeotdaCard, SeotdaCard],
  hand2: [SeotdaCard, SeotdaCard],
): CompareResult {
  const result1 = evaluateHand(hand1);
  const result2 = evaluateHand(hand2);

  //구사 계열은 일반적인 승패를 결정하지 않음
  //실제 게임에서는 재경기 여부를 game.ts에서 처리
  if (
    result1.special === "gusa" ||
    result1.special === "meongtunguri-gusa" ||
    result2.special === "gusa" ||
    result2.special === "meongtunguri-gusa"
  ) {
    return 0;
  }

  //땡잡이
  if (isDdaengJabiWin(result1.special, result2)) {
    return 1;
  }

  if (isDdaengJabiWin(result2.special, result1)) {
    return -1;
  }

  //암행어사
  if (isAmhaengEosaWin(result1.special, result2)) {
    return 1;
  }

  if (isAmhaengEosaWin(result2.special, result1)) {
    return -1;
  }

  //일반 족보
  if (result1.rank > result2.rank) {
    return 1;
  }

  if (result1.rank < result2.rank) {
    return -1;
  }

  //같은 족보
  if (result1.value > result2.value) {
    return 1;
  }

  if (result1.value < result2.value) {
    return -1;
  }

  return 0;
}
