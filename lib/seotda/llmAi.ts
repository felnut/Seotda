import {
  analyzeBettingSpot,
  BettingAction,
  BettingContext,
  decideBettingAction,
} from "./ai";
import { RAISE_RATIOS, RaiseRatio } from "./bettingRound";
import { bestHandFromThree, evaluateHand, getDisplayHandName } from "./ranking";
import { SeotdaCard } from "@/types/seotda";

// Groq(무료 티어)는 오직 "블러핑"에만 쓴다. 승률 계산과 콜/레이즈/다이 결정은
// 전부 ai.ts의 수학적 계산이 하고, 이번 판이 블러핑 후보로 뽑혔을 때(약한 패 +
// 상대가 적음 + 판 단위 확률 당첨)에만 "실제로 허세를 부릴지, 부린다면 얼마나
// 크게 레이즈할지"를 Groq에게 묻는다. 키가 없거나 호출이 실패/타임아웃되거나
// 답이 규칙에 어긋나면 ai.ts의 내장 블러핑 로직으로 그대로 대체된다 — 게임
// 진행이 외부 API 상태에 좌우되지 않게 하기 위함이다.

const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 4000;

// 429(한도 초과)를 받은 뒤 이 시각까지는 Groq를 호출하지 않는다.
let blockedUntil = 0;

// 이번 판에 Groq가 "블러핑하지 않겠다"고 답한 판 — 같은 판의 다음 베팅 단계에서
// 다시 묻지 않고(호출 절약) 같은 결정을 유지한다. 카드 목록이 판마다 바뀌므로
// 별도 핸드 ID 없이도 다음 판에는 자연히 새로 묻는다.
const declinedHands = new Set<string>();

function handKey(ctx: BettingContext): string {
  return `${ctx.player.id}:${ctx.player.cards!.slice(0, 2).map((c) => c.id).join(",")}`;
}

function rememberDeclined(key: string) {
  declinedHands.add(key);

  if (declinedHands.size > 500) {
    const oldest = declinedHands.values().next().value;
    if (oldest) declinedHands.delete(oldest);
  }
}

function describeHandName(cards: SeotdaCard[]): string {
  const result =
    cards.length >= 3
      ? bestHandFromThree(cards.slice(0, 3) as [SeotdaCard, SeotdaCard, SeotdaCard])
          .result
      : evaluateHand([cards[0], cards[1]]);

  return getDisplayHandName(result);
}

function buildMessages(ctx: BettingContext, opponentCount: number, equity: number) {
  const { player, players, pot, currentBet } = ctx;
  const toCall = Math.max(0, currentBet - player.bet);
  const revealed = players
    .filter((p) => p.id !== player.id && p.status === "playing" && !p.isSpectator)
    .map((p) =>
      p.cards && p.revealedCardIndex !== null
        ? `${p.cards[p.revealedCardIndex]?.name ?? "?"}`
        : "미공개",
    )
    .join(", ");

  const system = `너는 한국 전통 카드 게임 "섯다"를 하는 AI 플레이어고, 지금은 블러핑(허세) 여부만 정한다.
승률 계산과 일반적인 베팅은 다른 로직이 하니, 너는 "이 약한 패로 강한 척 판을 키울지"만 판단한다.
반드시 JSON 객체 하나만 답한다.
형식: {"bluff":true|false,"raiseRatio":"quarter|half|double","reasoning":"한 줄"}
bluff가 true면 raiseRatio로 레이즈 크기를 고른다(quarter=팟의 25%, half=50%, double=200%).
블러핑 후보는 이미 확률로 걸러서 드물게만 네게 오니, 상대가 이미 크게 베팅했거나 팟 대비 비용이 터무니없이 큰 경우가 아니면 true로 답해 판을 키워라.`;

  const user = `[내 상태]
- 패: ${describeHandName(player.cards!)} (계산상 승률 약 ${Math.round(equity * 100)}%, 약한 패)
- 보유 칩: ${player.chips}

[테이블 상태]
- 살아있는 상대: ${opponentCount}명, 공개한 카드: ${revealed || "없음"}
- 팟: ${pot}
- 현재 베팅액: ${currentBet}
- 콜에 추가로 필요한 금액: ${toCall}

이번 판은 블러핑 후보로 뽑혔어. 허세를 부릴까?`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function isRaiseRatio(value: string | undefined): value is RaiseRatio {
  return value === "quarter" || value === "half" || value === "double";
}

// 모델이 칩 부족 같은 규칙을 어긴 크기를 내놓아도 게임이 깨지지 않도록, 실제로
// 낼 수 있는 레이즈인지 다시 검증한다. 안 되면 null(=내장 블러핑으로 대체).
function validBluffRaise(ratio: string | undefined, ctx: BettingContext) {
  if (!isRaiseRatio(ratio)) return null;

  const { player, pot, currentBet } = ctx;
  const size = Math.floor(pot * RAISE_RATIOS[ratio]);
  const amountToPay = currentBet + size - player.bet;
  const remainingCap = player.maxBet - player.totalBet;

  const ok =
    size > 0 &&
    amountToPay > 0 &&
    amountToPay <= player.chips &&
    amountToPay <= remainingCap;

  return ok ? ({ type: "raise", ratio } as BettingAction) : null;
}

export async function decideBettingActionWithLlm(
  ctx: BettingContext,
): Promise<BettingAction> {
  // 평소에는 수학적 계산만으로 결정한다(내장 블러핑 포함).
  if (!API_KEY || !ctx.player.cards) {
    return decideBettingAction(ctx);
  }

  const spot = analyzeBettingSpot(ctx);

  // 블러핑 후보가 아닌 판은 Groq를 부르지 않는다.
  if (!spot.bluffCandidate) {
    return decideBettingAction({ ...ctx, disableBluff: true });
  }

  const key = handKey(ctx);

  // 이미 거절했거나 한도(429) 대기 중이면 묻지 않는다. 거절한 판은 블러핑 없이
  // 수학대로, 한도 대기 중에는 내장 블러핑으로 대체한다.
  if (declinedHands.has(key)) {
    return decideBettingAction({ ...ctx, disableBluff: true });
  }

  if (Date.now() < blockedUntil) return decideBettingAction(ctx);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(ctx, spot.opponents.length, spot.equityRaw),
        response_format: { type: "json_object" },
        temperature: 0.7,
        // gpt-oss 같은 추론 모델은 생각에도 토큰을 쓰므로, 낮은 추론 강도와
        // 넉넉한 토큰으로 답(JSON)이 잘리지 않게 한다.
        reasoning_effort: "low",
        max_completion_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));

        blockedUntil =
          Date.now() +
          (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) *
            1000;
      }

      throw new Error(`Groq 응답 오류 ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "") as {
      bluff?: boolean;
      raiseRatio?: string;
    };

    if (parsed.bluff === true) {
      const raise = validBluffRaise(parsed.raiseRatio, ctx);

      // 허세를 부리기로 했지만 낼 수 없는 크기면 내장 블러핑으로 대체한다.
      return raise ?? decideBettingAction(ctx);
    }

    if (parsed.bluff === false) {
      rememberDeclined(key);

      return decideBettingAction({ ...ctx, disableBluff: true });
    }

    return decideBettingAction(ctx);
  } catch (error) {
    console.warn("Groq 블러핑 판단 실패, 내장 로직으로 대체:", error);

    return decideBettingAction(ctx);
  } finally {
    clearTimeout(timer);
  }
}
