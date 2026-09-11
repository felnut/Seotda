import { GoogleGenAI, Type } from "@google/genai";
import {
  BettingAction,
  BettingContext,
  decideBettingAction as decideBettingActionRuleBased,
} from "./ai";
import { RAISE_RATIOS, RaiseRatio } from "./bettingRound";
import { bestHandFromThree, evaluateHand, getDisplayHandName } from "./ranking";
import { SeotdaCard } from "@/types/seotda";

// Gemini(무료 티어)로 베팅 판단을 내리는 AI. API 키가 없거나 호출이
// 실패/타임아웃되면 ai.ts의 규칙 기반 로직으로 그대로 대체된다 — 게임
// 진행 자체가 외부 API 상태에 좌우되지 않게 하기 위함이다.

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const TIMEOUT_MS = 4000;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: ["check", "call", "raise", "allIn", "fold"],
    },
    raiseRatio: {
      type: Type.STRING,
      enum: ["quarter", "half", "double"],
    },
    reasoning: { type: Type.STRING },
  },
  required: ["action", "reasoning"],
};

// 판(핸드) 단위로 한 번만 굴려 베팅1~2 내내 유지하는 성향 — 규칙 기반
// ai.ts처럼 매 판단마다 다시 굴리면 같은 판에서 베팅1엔 블러핑하다가
// 베팅2엔 정직해지는 등 사람이 보기에 일관성 없는 행동이 된다. 카드
// 목록 자체가 판마다 바뀌므로, 이를 캐시 키에 포함하면 별도의 핸드 ID
// 없이도 다음 판에서 자연히 새 성향이 뽑힌다.
const personaCache = new Map<string, string>();

const PERSONAS = [
  "이번 판은 패가 약해도 과감하게 강한 척 베팅해서 블러핑을 노려본다.",
  "이번 판은 패가 강해도 천천히, 약한 척 베팅해서 상대를 유인한다(슬로우플레이).",
  "이번 판은 패 강도에 정직하게, 있는 그대로 베팅한다.",
];

function getPersona(playerId: string, cards: SeotdaCard[]): string {
  const key = `${playerId}:${cards.map((card) => card.id).join(",")}`;
  let persona = personaCache.get(key);

  if (!persona) {
    const roll = Math.random();

    persona = roll < 0.2 ? PERSONAS[0] : roll < 0.35 ? PERSONAS[1] : PERSONAS[2];
    personaCache.set(key, persona);

    // 캐시가 끝없이 쌓이지 않도록 가장 오래된 항목부터 정리한다.
    if (personaCache.size > 500) {
      const oldestKey = personaCache.keys().next().value;
      if (oldestKey) personaCache.delete(oldestKey);
    }
  }

  return persona;
}

function describeHandName(cards: SeotdaCard[]): string {
  const result =
    cards.length >= 3
      ? bestHandFromThree(cards.slice(0, 3) as [SeotdaCard, SeotdaCard, SeotdaCard])
          .result
      : evaluateHand([cards[0], cards[1]]);

  return getDisplayHandName(result);
}

function buildPrompt(ctx: BettingContext): string {
  const { player, pot, currentBet } = ctx;
  const handName = describeHandName(player.cards!);
  const toCall = currentBet - player.bet;
  const persona = getPersona(player.id, player.cards!);

  return `너는 한국 전통 카드 게임 "섯다"를 하는 AI 플레이어야.

[네 상태]
- 패: ${handName}
- 보유 칩: ${player.chips}
- 이번 판 성향: ${persona}

[테이블 상태]
- 팟: ${pot}
- 현재 베팅액: ${currentBet}
- 네가 이미 이번 라운드에 낸 베팅액: ${player.bet}
- 콜하려면 추가로 필요한 금액: ${Math.max(0, toCall)}

check(추가 베팅 없이 넘기기) / call(맞추기) / raise(레이즈 — quarter는 팟의 25%, half는 팟의 50%, double은 팟의 200%) / allIn(올인) / fold(다이) 중 하나를 선택해서 행동해.
추가로 필요한 금액이 0보다 크면 check는 고를 수 없고, 칩이 부족해 콜을 못 하면 allIn이나 fold만 가능해.
위에 정한 이번 판 성향을 베팅1·베팅2 내내 일관되게 유지해.`;
}

// 모델이 규칙(칩 부족, toCall=0인데 call을 고르는 등)을 어긴 응답을
// 내놓아도 게임이 깨지지 않도록, 실행 가능한 행동인지 다시 검증한다.
// 검증에 실패하면 규칙 기반 로직으로 대체한다.
function normalizeAction(
  parsed: { action: string; raiseRatio?: string },
  ctx: BettingContext,
): BettingAction {
  const { player, pot, currentBet } = ctx;
  const toCall = currentBet - player.bet;
  const remainingCap = player.maxBet - player.totalBet;

  if (parsed.action === "check" && toCall <= 0) {
    return { type: "check" };
  }

  if (parsed.action === "call") {
    const canCall = toCall > 0 && toCall <= player.chips && toCall <= remainingCap;
    if (canCall) return { type: "call" };
  }

  if (parsed.action === "raise" && isRaiseRatio(parsed.raiseRatio)) {
    const size = Math.floor(pot * RAISE_RATIOS[parsed.raiseRatio]);
    const amountToPay = currentBet + size - player.bet;
    const canRaise =
      size > 0 &&
      amountToPay > 0 &&
      amountToPay <= player.chips &&
      amountToPay <= remainingCap;

    if (canRaise) return { type: "raise", ratio: parsed.raiseRatio };
  }

  if (parsed.action === "allIn" && player.chips > 0) {
    return { type: "allIn" };
  }

  if (parsed.action === "fold") {
    return { type: "fold" };
  }

  return decideBettingActionRuleBased(ctx);
}

function isRaiseRatio(value: string | undefined): value is RaiseRatio {
  return value === "quarter" || value === "half" || value === "double";
}

export async function decideBettingActionWithLlm(
  ctx: BettingContext,
): Promise<BettingAction> {
  if (!genAI || !ctx.player.cards) {
    return decideBettingActionRuleBased(ctx);
  }

  try {
    const response = await Promise.race([
      genAI.models.generateContent({
        model: MODEL,
        contents: buildPrompt(ctx),
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Gemini 응답 타임아웃")), TIMEOUT_MS);
      }),
    ]);

    const parsed = JSON.parse(response.text ?? "") as {
      action: string;
      raiseRatio?: string;
      reasoning?: string;
    };

    return normalizeAction(parsed, ctx);
  } catch (error) {
    console.warn("Gemini AI 판단 실패, 규칙 기반으로 대체:", error);
    return decideBettingActionRuleBased(ctx);
  }
}
