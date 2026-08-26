export interface HandGuideEntry {
  name: string;
  months: string;
  cardIds: [string, string];
}

// 순위가 높은 순서대로 정렬 (족보 선택 단계에서 참고용으로 사용)
export const HAND_GUIDE: HandGuideEntry[] = [
  { name: "38광땡", months: "3월 + 8월 (광)", cardIds: ["3-light", "8-light"] },
  { name: "18광땡", months: "1월 + 8월 (광)", cardIds: ["1-light", "8-light"] },
  { name: "13광땡", months: "1월 + 3월 (광)", cardIds: ["1-light", "3-light"] },
  { name: "장땡", months: "10월 + 10월", cardIds: ["10-ten", "10-dan"] },
  { name: "9땡", months: "9월 + 9월", cardIds: ["9-ten", "9-dan"] },
  { name: "8땡", months: "8월 + 8월", cardIds: ["8-light", "8-ten"] },
  { name: "7땡", months: "7월 + 7월", cardIds: ["7-ten", "7-dan"] },
  { name: "6땡", months: "6월 + 6월", cardIds: ["6-ten", "6-dan"] },
  { name: "5땡", months: "5월 + 5월", cardIds: ["5-ten", "5-dan"] },
  { name: "4땡", months: "4월 + 4월", cardIds: ["4-ten", "4-dan"] },
  { name: "3땡", months: "3월 + 3월", cardIds: ["3-light", "3-dan"] },
  { name: "2땡", months: "2월 + 2월", cardIds: ["2-ten", "2-dan"] },
  { name: "1땡", months: "1월 + 1월", cardIds: ["1-light", "1-dan"] },
  { name: "알리", months: "1월 + 2월", cardIds: ["1-dan", "2-ten"] },
  { name: "독사", months: "1월 + 4월", cardIds: ["1-dan", "4-ten"] },
  { name: "구삥", months: "1월 + 9월", cardIds: ["1-dan", "9-ten"] },
  { name: "장삥", months: "1월 + 10월", cardIds: ["1-dan", "10-ten"] },
  { name: "장사", months: "4월 + 10월", cardIds: ["4-ten", "10-ten"] },
  { name: "세륙", months: "4월 + 6월", cardIds: ["4-ten", "6-ten"] },
  { name: "갑오(아홉끗)", months: "월 합이 9", cardIds: ["4-dan", "5-dan"] },
  { name: "8끗", months: "월 합의 끝자리가 8", cardIds: ["2-ten", "6-ten"] },
  { name: "7끗", months: "월 합의 끝자리가 7", cardIds: ["3-dan", "4-dan"] },
  { name: "6끗", months: "월 합의 끝자리가 6", cardIds: ["2-dan", "4-dan"] },
  { name: "5끗", months: "월 합의 끝자리가 5", cardIds: ["7-dan", "8-ten"] },
  { name: "4끗", months: "월 합의 끝자리가 4", cardIds: ["1-dan", "3-dan"] },
  { name: "3끗", months: "월 합의 끝자리가 3", cardIds: ["5-dan", "8-ten"] },
  { name: "2끗", months: "월 합의 끝자리가 2", cardIds: ["3-dan", "9-ten"] },
  { name: "1끗", months: "월 합의 끝자리가 1", cardIds: ["2-dan", "9-dan"] },
  { name: "망통", months: "월 합의 끝자리가 0", cardIds: ["2-dan", "8-ten"] },
];

export interface SpecialHandGuideEntry {
  name: string;
  effect: string;
  months: string;
  cardIds: [string, string];
}

// 조건이 맞으면 순위표와 무관하게 특별한 효과가 발동하는 조합
export const SPECIAL_HAND_GUIDE: SpecialHandGuideEntry[] = [
  {
    name: "멍텅구리 구사",
    effect: "무승부, 재경기",
    months: "4월(열끗) + 9월(열끗)",
    cardIds: ["4-ten", "9-ten"],
  },
  {
    name: "구사",
    effect: "무승부, 재경기",
    months: "4월 + 9월",
    cardIds: ["4-dan", "9-dan"],
  },
  {
    name: "땡잡이",
    effect: "상대가 1~9땡이면 승리",
    months: "3월(광) + 7월(열끗)",
    cardIds: ["3-light", "7-ten"],
  },
  {
    name: "암행어사",
    effect: "상대가 13/18광땡이면 승리",
    months: "4월(열끗) + 7월(열끗)",
    cardIds: ["4-ten", "7-ten"],
  },
];
