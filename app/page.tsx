"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BankruptcyNotice,
  ChatMessage,
  ClientGameState,
  ClientPlayer,
  RoomInfo,
  RoomPlayerInfo,
  SeotdaCard,
  VisibleCard,
} from "@/types/seotda";
import { HAND_GUIDE, SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { evaluateHand, getDisplayHandName } from "@/lib/seotda/ranking";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { useAuth } from "@/lib/useAuth";
import { PROFILES_COLLECTION, UserProfile } from "@/lib/profile";
import { RANKINGS_COLLECTION, RankingEntry } from "@/lib/ranking";
import { STARTING_CHIPS } from "@/lib/seotda/game";
import { socket } from "@/lib/socket";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { loadNickname, saveNickname } from "@/lib/nickname";
import { RankingModal } from "./components/RankingModal";
import { GoogleSignInButton } from "./components/GoogleSignInButton";

const CLEAN_BOT_STORAGE_KEY = "seotda-clean-bot";

const MIN_ROOM_PLAYERS = 2;
const MAX_ROOM_PLAYERS = 6;

// 방장이 최소 인원 미달인 채로 "게임 시작"을 눌렀을 때 보여주는 안내.
const NOT_ENOUGH_PLAYERS_ERROR = "함께할 플레이어가 부족합니다.";

// compact: 상대방 카드처럼 화면 공간을 아끼는 작은 크기 / cozy: 내 카드처럼 강조되는 큰 크기
type CardSize = "compact" | "cozy";

const CARD_SIZE_CLASS: Record<CardSize, string> = {
  compact: "w-9 sm:w-11",
  cozy: "w-14 sm:w-16 lg:w-20",
};

interface CardProps {
  card: SeotdaCard;
  index?: number;
  size?: CardSize;
}

function Card({ card, index = 0, size = "cozy" }: CardProps) {
  return (
    <div
      className={`animate-card-in relative aspect-2/3 shrink-0 overflow-hidden rounded-lg border border-gold/25 shadow-lg shadow-black/50 ${CARD_SIZE_CLASS[size]}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Image
        src={`/card/${card.id}.png`}
        alt={card.name}
        fill
        sizes="(min-width: 1024px) 80px, (min-width: 640px) 64px, 44px"
        className="object-cover"
      />

      <span className="absolute top-0.5 left-0.5 flex h-6 min-w-6 items-center justify-center rounded bg-black/70 px-1 font-mono text-[17.5px] font-bold text-gold-bright sm:h-7 sm:min-w-7 sm:text-xl">
        {card.month}
      </span>
    </div>
  );
}

function CardBack({
  index = 0,
  size = "cozy",
}: {
  index?: number;
  size?: CardSize;
}) {
  return (
    <div
      className={`animate-fade-up flex aspect-2/3 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-linear-to-br from-zinc-800 to-zinc-900 shadow-lg shadow-black/40 ${CARD_SIZE_CLASS[size]}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="text-[22.5px] font-bold text-white/30 sm:text-3xl">
        ?
      </span>
    </div>
  );
}

function MiniCard({ cardId, alt }: { cardId: string; alt: string }) {
  return (
    <div className="relative h-12.5 w-8 shrink-0 overflow-hidden rounded-md border border-white/10 shadow-sm">
      <Image
        src={`/card/${cardId}.png`}
        alt={alt}
        fill
        sizes="32px"
        className="object-cover"
      />
    </div>
  );
}

// 족보 가이드에서 하이라이팅할 족보 이름들을 계산한다.
// 아직 족보를 확정하지 않았다면(3장 중 2장 선택 전) 가능한 조합을 모두 보여주고,
// 확정했다면(또는 카드가 2장뿐이라 조합이 하나뿐이면) 그 하나만 보여준다.
function getGuideHighlights(
  cards: SeotdaCard[],
  selectedIndices: [number, number] | null,
) {
  const normalNames = new Set<string>();
  const specialNames = new Set<string>();

  const addFromPair = (i: number, j: number) => {
    const card1 = cards[i];
    const card2 = cards[j];

    if (!card1 || !card2) return;

    const result = evaluateHand([card1, card2]);

    if (result.special !== "none") {
      specialNames.add(getDisplayHandName(result));
    } else {
      normalNames.add(result.name);
    }
  };

  if (cards.length === 2) {
    addFromPair(0, 1);
  } else if (cards.length === 3) {
    if (selectedIndices) {
      addFromPair(selectedIndices[0], selectedIndices[1]);
    } else {
      addFromPair(0, 1);
      addFromPair(0, 2);
      addFromPair(1, 2);
    }
  }

  return { normalNames, specialNames };
}

function HandGuidePanel({
  open,
  onClose,
  myCards,
  selectedIndices,
}: {
  open: boolean;
  onClose: () => void;
  myCards: SeotdaCard[];
  selectedIndices: [number, number] | null;
}) {
  const { normalNames, specialNames } = getGuideHighlights(
    myCards,
    selectedIndices,
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-bold">족보 가이드</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[15px] font-semibold tracking-wide text-gold">
            특수 족보
          </p>

          <ul className="mb-6 space-y-2">
            {SPECIAL_HAND_GUIDE.map((entry) => {
              const isMine = specialNames.has(entry.name);

              return (
                <li
                  key={entry.name}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                    isMine
                      ? "border-gold/60 bg-gold/10 ring-1 ring-gold/40"
                      : "border-white/5 bg-white/3"
                  }`}
                >
                  <div className="flex gap-1">
                    <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                    <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-[17.5px] font-semibold">
                      {entry.name}
                      {isMine && (
                        <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-gold-bright">
                          내 패
                        </span>
                      )}
                    </p>
                    <p className="text-[15px] text-zinc-400">{entry.months}</p>
                    <p className="text-[15px] text-felt-bright">
                      {entry.effect}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mb-2 text-[15px] font-semibold tracking-wide text-gold">
            일반 족보 (높은 순)
          </p>

          <ul className="space-y-2 pb-4">
            {HAND_GUIDE.map((entry, index) => {
              const isMine = normalNames.has(entry.name);

              return (
                <li
                  key={entry.name}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                    isMine
                      ? "border-gold/60 bg-gold/10 ring-1 ring-gold/40"
                      : "border-white/5 bg-white/3"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[15px] font-bold text-zinc-400">
                    {index + 1}
                  </span>

                  <div className="flex gap-1">
                    <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                    <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-[17.5px] font-semibold">
                      {entry.name}
                      {isMine && (
                        <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-gold-bright">
                          내 패
                        </span>
                      )}
                    </p>
                    <p className="text-[15px] text-zinc-400">{entry.months}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </>
  );
}

// 640px는 Tailwind의 sm 브레이크포인트와 같다 — 그 이상에서는 채팅을 항상
// 열려 있는 도킹 패널로 붙박아 보여주고, 그 아래(모바일)에서만 버튼으로
// 여닫는 오버레이로 동작한다.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 640px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    query.addEventListener("change", handleChange);

    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

// 완전한 검열은 목표가 아니다 — "끄면 원문 그대로, 켜면 흔한 비속어 몇
// 개는 가려준다" 정도의 개인 설정용 순화 기능이라 목록은 일부러 짧게 둔다.
const PROFANITY_WORDS = [
  "씨발",
  "씨팔",
  "시발",
  "개새끼",
  "병신",
  "지랄",
  "좆",
  "fuck",
  "shit",
  "bitch",
];

function maskProfanity(text: string, enabled: boolean): string {
  if (!enabled) return text;

  let masked = text;

  for (const word of PROFANITY_WORDS) {
    masked = masked.replaceAll(new RegExp(word, "gi"), "❋".repeat(word.length));
  }

  return masked;
}

const EMOJI_OPTIONS = [
  "😀",
  "😂",
  "😅",
  "😉",
  "😍",
  "🤔",
  "😮",
  "😢",
  "😡",
  "🥳",
  "😴",
  "🤐",
  "👍",
  "👎",
  "🙏",
  "👏",
  "🔥",
  "💰",
  "💸",
  "🎉",
  "🎲",
  "🍀",
  "🃏",
  "😱",
];

function ChatPanel({
  open,
  onClose,
  messages,
  myPlayerId,
  input,
  onInputChange,
  onSend,
  typingNames,
  cleanBot,
  onToggleCleanBot,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  myPlayerId: string;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  typingNames: string[];
  cleanBot: boolean;
  onToggleCleanBot: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const isDesktop = useIsDesktop();
  // 데스크톱에서는 채팅이 항상 화면에 붙박이로 보이므로 open 상태와
  // 무관하게 늘 조작 가능해야 한다 — 모바일일 때만 open이 실제 표시 여부다.
  const isVisible = isDesktop || open;

  // 패널이 보이거나 새 메시지가 도착하면 항상 맨 아래로 스크롤한다.
  useEffect(() => {
    if (!isVisible) return;

    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [isVisible, messages]);

  // 데스크톱(sm 이상)에서는 레이아웃에 자리를 차지하는 도킹 패널로,
  // 모바일에서는 문서 흐름 밖의 fixed 오버레이로 오른쪽에서 슬라이드인한다.
  return (
    <aside
      // 모바일에서 닫혀 있는 동안에는 화면 밖으로 밀려나 있는 안의
      // 입력창/버튼이 키보드 탭 이동으로 포커스되지 않도록 inert 처리한다.
      // 데스크톱에서는 항상 보이므로 inert를 걸지 않는다.
      inert={!isVisible}
      className={`z-40 flex w-56 shrink-0 flex-col overflow-hidden border-white/10 bg-zinc-950/95 transition-transform duration-300 sm:relative sm:w-72 sm:translate-x-0 sm:border-l sm:bg-zinc-950/60 sm:shadow-none md:w-80 lg:w-96 ${
        open
          ? "fixed inset-y-0 right-0 translate-x-0 border-l shadow-2xl"
          : "fixed inset-y-0 right-0 translate-x-full border-l shadow-2xl"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:py-4">
        <h3 className="text-[17.5px] font-bold sm:text-[22.5px]">채팅</h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCleanBot}
            aria-pressed={cleanBot}
            title="클린봇 — 비속어를 가려서 보여줍니다"
            className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
              cleanBot
                ? "bg-felt/20 text-felt-bright"
                : "bg-white/5 text-zinc-500 hover:bg-white/10"
            }`}
          >
            클린봇 {cleanBot ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white sm:hidden"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-[13.5px] text-zinc-500">
            아직 메시지가 없습니다.
          </p>
        )}

        {messages.map((message) => {
          const isMine = message.playerId === myPlayerId;

          return (
            <div
              key={message.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              <span className="mb-0.5 max-w-[85%] truncate text-[11px] font-medium text-zinc-500">
                {isMine ? "나" : message.name}
              </span>

              <p
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13.5px] wrap-break-word sm:px-3.5 sm:py-2 sm:text-[15px] ${
                  isMine ? "bg-gold text-zinc-900" : "bg-white/8 text-zinc-100"
                }`}
              >
                {maskProfanity(message.text, cleanBot)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 px-3 sm:px-4">
        <p
          className={`h-4 truncate text-[11.5px] text-zinc-500 transition-opacity ${
            typingNames.length > 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          {typingNames.length === 1
            ? `${typingNames[0]}님이 입력 중...`
            : typingNames.length > 1
              ? `${typingNames.slice(0, 2).join(", ")} 외 ${
                  typingNames.length - 2 > 0 ? typingNames.length - 2 : ""
                }명이 입력 중...`
              : " "}
        </p>
      </div>

      <div className="relative shrink-0">
        {isEmojiOpen && (
          <div className="absolute right-2.5 bottom-full mb-2 grid w-52 grid-cols-6 gap-1 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-2xl sm:right-3">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onInputChange(`${input}${emoji}`);
                  setIsEmojiOpen(false);
                }}
                className="rounded-lg py-1 text-[19px] transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
            setIsEmojiOpen(false);
          }}
          className="flex gap-1.5 border-t border-white/10 p-2.5 sm:gap-2 sm:p-3"
        >
          <button
            type="button"
            onClick={() => setIsEmojiOpen((prev) => !prev)}
            aria-label="이모티콘"
            aria-expanded={isEmojiOpen}
            className={`shrink-0 rounded-xl border px-2.5 text-[17px] transition ${
              isEmojiOpen
                ? "border-gold/50 bg-gold/10"
                : "border-white/10 bg-black/30 hover:border-white/20"
            }`}
          >
            😊
          </button>

          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="메시지 입력..."
            maxLength={200}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20 sm:px-3.5 sm:py-2.5 sm:text-[15px]"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-xl bg-gold px-3 py-2 text-[13.5px] font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-gold-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:px-4 sm:py-2.5 sm:text-[15px]"
          >
            전송
          </button>
        </form>
      </div>
    </aside>
  );
}

// 카드 3장 중 족보로 쓸 수 있는 2장의 조합(3가지)과 각 조합의 족보를 계산한다.
const CARD_PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
];

function getPossibleHands(cards: VisibleCard[]) {
  const hands = CARD_PAIRS.filter(
    ([i, j]) => cards[i]?.card && cards[j]?.card,
  ).map(([i, j]) => {
    const result = evaluateHand([
      cards[i].card as SeotdaCard,
      cards[j].card as SeotdaCard,
    ]);

    return {
      indices: [i, j] as [number, number],
      name: getDisplayHandName(result),
      rank: result.rank,
    };
  });

  const bestRank = Math.max(...hands.map((hand) => hand.rank));

  return hands.map((hand) => ({ ...hand, isBest: hand.rank === bestRank }));
}

const PHASE_LABEL: Partial<Record<ClientGameState["phase"], string>> = {
  reveal: "카드 공개 단계",
  select: "족보 선택 단계",
  showdown: "쇼다운",
  finished: "게임 종료",
};

// 판돈 규모에 따라 쌓이는 칩 색만 다르게 보여주는 장식용 스택이다 — 정확한
// 금액은 항상 바로 아래 텍스트로 표기하므로, 이 그림은 눈대중용일 뿐이다.
function ChipStack({ amount }: { amount: number }) {
  const colors =
    amount >= 20_000
      ? ["bg-crimson", "bg-gold", "bg-felt"]
      : amount >= 5_000
        ? ["bg-gold", "bg-felt"]
        : amount >= 1_000
          ? ["bg-felt", "bg-zinc-400"]
          : ["bg-zinc-400"];

  return (
    <div className="flex flex-col-reverse items-center" aria-hidden>
      {colors.map((color, index) => (
        <span
          key={index}
          className={`h-2 w-7 rounded-full border border-black/40 sm:w-8 ${color}`}
          style={{ marginTop: index === 0 ? 0 : "-5px" }}
        />
      ))}
    </div>
  );
}

function PotBadge({ pot, turnLabel }: { pot: number; turnLabel: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 py-1">
      <ChipStack amount={pot} />

      <div className="flex flex-col items-center rounded-2xl border border-gold/40 bg-zinc-950/80 px-5 py-1.5">
        <p className="text-[10px] font-bold tracking-widest text-gold-bright">
          POT
        </p>

        <p
          key={pot}
          className="animate-pop-in font-mono text-[17.5px] font-bold tabular-nums text-gold sm:text-[19px]"
        >
          {pot.toLocaleString()}
        </p>
      </div>

      <p className="text-[13px] font-medium text-zinc-400 sm:text-[15px]">
        {turnLabel}
      </p>
    </div>
  );
}

interface PlayerPanelProps {
  player: ClientPlayer;
  isMe: boolean;
  isCurrent: boolean;
  compact: boolean;
  phase: ClientGameState["phase"];
  pendingSelection: number[];
  onRevealCard: (cardIndex: number) => void;
  onToggleSelect: (cardIndex: number) => void;
  onConfirmSelect: () => void;
}

function PlayerPanel({
  player,
  isMe,
  isCurrent,
  compact,
  phase,
  pendingSelection,
  onRevealCard,
  onToggleSelect,
  onConfirmSelect,
}: PlayerPanelProps) {
  const canRevealNow =
    isMe &&
    phase === "reveal" &&
    player.status === "playing" &&
    player.revealedCardIndex === null;

  const canSelectNow =
    isMe &&
    phase === "select" &&
    player.status === "playing" &&
    !player.hasSelectedHand;

  return (
    <div
      className={`rounded-2xl border px-4 py-2.5 backdrop-blur-sm transition sm:px-5 ${
        compact ? "sm:py-3" : "sm:py-3.5"
      } ${isMe ? "border-gold/25 bg-gold/4" : "border-white/10 bg-white/3"} ${
        isCurrent
          ? "animate-turn-glow ring-2 ring-gold/70 ring-offset-2 ring-offset-zinc-950"
          : ""
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-gold/80 to-gold-deep/80 font-bold text-zinc-900 ${
              compact
                ? "h-6 w-6 text-[15px]"
                : "h-8 w-8 text-[17.5px] sm:h-9 sm:w-9"
            }`}
          >
            {player.name.charAt(0)}
          </div>

          <h2
            className={`flex min-w-0 items-center ${
              compact
                ? "text-[17.5px] font-semibold"
                : "text-xl font-semibold sm:text-[22.5px]"
            }`}
          >
            <span className="max-w-24 truncate sm:max-w-36" title={player.name}>
              {player.name}
            </span>

            {isMe && (
              <span className="ml-2 shrink-0 text-[15px] font-medium text-felt-bright">
                나
              </span>
            )}

            {player.isAI && (
              <span className="ml-2 shrink-0 rounded-full bg-felt/15 px-2 py-0.5 text-[13px] font-bold text-felt-bright">
                AI
              </span>
            )}
          </h2>

          <span className="shrink-0 font-mono text-[15px] tabular-nums text-zinc-500">
            칩 {player.chips.toLocaleString()}
          </span>

          {player.bet > 0 && (
            <span className="shrink-0 font-mono text-[15px] tabular-nums text-zinc-500">
              베팅{" "}
              <span className="text-zinc-300">
                {player.bet.toLocaleString()}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {player.lastAction && player.status !== "folded" && (
            <span className="animate-pop-in rounded-full bg-felt/15 px-2.5 py-0.5 text-[14px] font-bold text-felt-bright">
              {player.lastAction}
            </span>
          )}

          {isCurrent && (
            <span className="rounded-full bg-gold px-2.5 py-0.5 text-[14px] font-bold text-zinc-900">
              차례
            </span>
          )}

          {player.isSpectator && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[14px] font-bold text-zinc-400">
              관전 중
            </span>
          )}

          {!player.isSpectator && player.status === "folded" && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[14px] font-bold text-zinc-400">
              다이
            </span>
          )}

          {phase === "finished" && player.status === "winner" && (
            <span className="rounded-full bg-felt-bright/15 px-2.5 py-0.5 text-[14px] font-bold text-felt-bright">
              승리
            </span>
          )}

          {phase === "finished" && player.status === "loser" && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[14px] font-bold text-zinc-400">
              패배
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {player.cards.map((visibleCard, index) => {
          const isPendingSelected = pendingSelection.includes(index);

          if (visibleCard.revealed && visibleCard.card) {
            return (
              <div
                key={visibleCard.id}
                className="flex flex-col items-center gap-1"
              >
                <button
                  type="button"
                  disabled={!canSelectNow}
                  onClick={() => onToggleSelect(index)}
                  className={`rounded-lg transition ${
                    canSelectNow
                      ? "cursor-pointer hover:scale-[1.03]"
                      : "cursor-default"
                  } ${
                    isPendingSelected
                      ? "ring-2 ring-gold ring-offset-2 ring-offset-zinc-950"
                      : ""
                  }`}
                >
                  <Card
                    card={visibleCard.card}
                    index={index}
                    size={compact ? "compact" : "cozy"}
                  />
                </button>

                {index === player.revealedCardIndex && (
                  <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold-bright">
                    공개됨
                  </span>
                )}

                {player.selectedIndices?.includes(index) && (
                  <span className="rounded-full bg-felt-bright/15 px-1.5 py-0.5 text-[11px] font-semibold text-felt-bright">
                    족보로 선택됨
                  </span>
                )}

                {canRevealNow && index !== player.revealedCardIndex && (
                  <button
                    type="button"
                    onClick={() => onRevealCard(index)}
                    className="rounded-full bg-gold px-2.5 py-0.5 text-[13px] font-semibold text-zinc-900 transition hover:scale-105 hover:bg-gold-bright active:scale-95"
                  >
                    이 카드 공개
                  </button>
                )}
              </div>
            );
          }

          return (
            <CardBack
              key={visibleCard.id}
              index={index}
              size={compact ? "compact" : "cozy"}
            />
          );
        })}

        {/* 족보 표시: 본인은 항상, 상대는 쇼다운/종료 후 공개된 시점에만 */}
        {player.handName &&
          (isMe || phase === "showdown" || phase === "finished") && (
            <div
              key={player.handName}
              className="animate-pop-in flex flex-col items-center justify-center rounded-xl border border-gold/20 bg-black/20 px-3 py-1.5 text-center sm:px-4"
            >
              <p className="text-[11px] font-medium text-zinc-400">족보</p>
              <p className="text-[22.5px] font-bold text-gold-bright sm:text-[25px]">
                {player.handName}
              </p>
            </div>
          )}
      </div>

      {isMe &&
        player.cards.length === 3 &&
        player.cards.every((visibleCard) => visibleCard.card) && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {getPossibleHands(player.cards).map(({ indices, name, isBest }) => (
              <span
                key={`${indices[0]}-${indices[1]}`}
                className={`rounded-full px-2 py-0.5 text-[14px] transition ${
                  isBest
                    ? "border border-gold/60 bg-gold/10 text-gold-bright ring-1 ring-gold/40"
                    : "border border-transparent bg-white/5 text-zinc-400"
                }`}
              >
                {indices[0] + 1}+{indices[1] + 1}{" "}
                <span
                  className={`font-semibold ${isBest ? "text-gold-bright" : "text-zinc-200"}`}
                >
                  {name}
                </span>
              </span>
            ))}
          </div>
        )}

      {canRevealNow && (
        <p className="mt-1.5 text-center text-[17.5px] text-gold-bright">
          상대에게 보여줄 카드 한 장을 골라주세요.
        </p>
      )}

      {isMe && phase === "reveal" && player.revealedCardIndex !== null && (
        <p className="mt-1.5 text-center text-[17.5px] text-zinc-400">
          상대의 선택을 기다리는 중...
        </p>
      )}

      {canSelectNow && (
        <div className="mt-1.5 text-center">
          <p className="mb-1.5 text-[17.5px] text-gold-bright">
            족보로 쓸 카드 2장을 골라주세요. ({pendingSelection.length}/2)
          </p>

          <button
            type="button"
            onClick={onConfirmSelect}
            disabled={pendingSelection.length !== 2}
            className="rounded-xl bg-gold px-5 py-1.5 text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-gold-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            족보 확정
          </button>
        </div>
      )}

      {isMe && phase === "select" && player.hasSelectedHand && (
        <p className="mt-1.5 text-center text-[17.5px] text-zinc-400">
          상대의 선택을 기다리는 중...
        </p>
      )}
    </div>
  );
}

function SeatCard({
  name,
  isMe,
  filled,
  isHost,
  isReady,
  isAI,
  onRemove,
}: {
  name: string;
  isMe: boolean;
  filled: boolean;
  isHost: boolean;
  isReady: boolean;
  isAI: boolean;
  // 방장 화면에서 이 자리가 AI일 때만 전달된다 — 있으면 "빼기" 버튼을 보여준다.
  onRemove?: () => void;
}) {
  if (!filled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/2 px-6 py-6 text-center sm:py-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/20 text-[17.5px] text-zinc-600 sm:h-10 sm:w-10">
          ?
        </div>

        <p className="text-[17.5px] text-zinc-500">상대방을 기다리는 중...</p>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border px-6 py-6 text-center sm:py-8 ${
        isMe ? "border-gold/25 bg-gold/4" : "border-white/10 bg-white/3"
      }`}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} 빼기`}
          className="absolute top-2 right-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[12px] font-semibold text-zinc-400 transition hover:border-crimson/40 hover:bg-crimson/10 hover:text-crimson-bright"
        >
          빼기
        </button>
      )}

      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-gold/80 to-gold-deep/80 text-[17.5px] font-bold text-zinc-900 sm:h-10 sm:w-10">
        {name.charAt(0)}
      </div>

      <p className="flex max-w-full items-center text-[17.5px] font-semibold">
        <span className="max-w-28 truncate sm:max-w-40" title={name}>
          {name}
        </span>

        {isMe && (
          <span className="ml-1.5 shrink-0 text-[15px] font-medium text-felt-bright">
            나
          </span>
        )}
      </p>

      <span
        className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${
          isAI
            ? "bg-felt/15 text-felt-bright"
            : isHost
              ? "bg-gold/15 text-gold-bright"
              : isReady
                ? "bg-felt/20 text-felt-bright"
                : "bg-white/5 text-zinc-500"
        }`}
      >
        {isAI ? "AI" : isHost ? "방장" : isReady ? "준비 완료" : "대기 중"}
      </span>
    </div>
  );
}

interface GameBoardProps {
  gameState: ClientGameState;
  playerId: string;
  onRevealCard: (cardIndex: number) => void;
  pendingSelection: number[];
  onToggleSelect: (cardIndex: number) => void;
  onConfirmSelect: () => void;
}

function GameBoard({
  gameState,
  playerId,
  onRevealCard,
  pendingSelection,
  onToggleSelect,
  onConfirmSelect,
}: GameBoardProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isBettingPhase =
    gameState.phase === "betting1" || gameState.phase === "betting2";

  const me = gameState.players.find((player) => player.id === playerId);
  const opponents = gameState.players.filter(
    (player) => player.id !== playerId,
  );

  const turnLabel = isBettingPhase
    ? `${currentPlayer?.name ?? ""}의 차례`
    : (PHASE_LABEL[gameState.phase] ?? gameState.phase);

  return (
    <div className="relative flex flex-1 flex-col justify-between gap-2 rounded-4xl border border-gold/25 bg-felt/8 p-2.5 sm:gap-3 sm:p-4">
      {/* 상대방은 테이블 위쪽에 가로로 둘러앉는다(둥근 테이블 흉내) */}
      {opponents.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-wrap content-start justify-center gap-1.5 overflow-y-auto sm:gap-2">
          {opponents.map((opponent) => (
            <div
              key={opponent.id}
              className="w-full sm:max-w-[calc(50%-0.25rem)]"
            >
              <PlayerPanel
                player={opponent}
                isMe={false}
                isCurrent={isBettingPhase && opponent.id === currentPlayer?.id}
                compact
                phase={gameState.phase}
                pendingSelection={pendingSelection}
                onRevealCard={onRevealCard}
                onToggleSelect={onToggleSelect}
                onConfirmSelect={onConfirmSelect}
              />
            </div>
          ))}
        </div>
      )}

      {/* 테이블 한가운데 팟 */}
      <PotBadge pot={gameState.pot} turnLabel={turnLabel} />

      {/* 나는 항상 테이블 앞자리(맨 아래)에 앉는다 */}
      {me && (
        <PlayerPanel
          player={me}
          isMe
          isCurrent={isBettingPhase && me.id === currentPlayer?.id}
          compact={false}
          phase={gameState.phase}
          pendingSelection={pendingSelection}
          onRevealCard={onRevealCard}
          onToggleSelect={onToggleSelect}
          onConfirmSelect={onConfirmSelect}
        />
      )}
    </div>
  );
}

// 누군가 방을 나갔을 때 잠깐 보여주는 알림 (5초 후 자동으로 사라짐)
function LeaveNoticeToast({ message }: { message: string | null }) {
  return (
    <div
      className={`pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        message ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {message && (
        <p className="animate-fade-up rounded-full border border-white/10 bg-zinc-900/95 px-4 py-2 text-[14px] font-medium text-zinc-200 shadow-lg shadow-black/40">
          {message}
        </p>
      )}
    </div>
  );
}

function ProfilePanel({
  open,
  onClose,
  email,
  name,
  onNameChange,
  onSave,
  saving,
  saved,
  error,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  email: string | null;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-bold">설정</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {email && (
            <p className="mb-4 text-[14px] text-zinc-400">{email}로 로그인됨</p>
          )}

          <label className="mb-1.5 block text-[13px] font-medium text-zinc-500">
            닉네임
          </label>

          <input
            value={name}
            onChange={(event) => {
              onNameChange(event.target.value);
            }}
            placeholder="닉네임을 입력하세요"
            maxLength={13}
            className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          />

          <p className="mb-4 text-[13px] text-zinc-500">
            여기서 설정한 닉네임은 방 참가 시 이름을 따로 입력하지 않으면
            기본값으로 쓰이고, 랭킹에도 이 이름으로 표시돼요.
          </p>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-xl bg-gold px-6 py-2.5 text-[15px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? "저장 중..." : "닉네임 저장"}
          </button>

          {saved && (
            <p className="mt-2 text-center text-[13.5px] text-felt-bright">
              저장됐어요.
            </p>
          )}

          {error && (
            <p className="mt-2 text-center text-[13.5px] text-crimson-bright">
              {error}
            </p>
          )}

          <div className="my-5 border-t border-white/10" />

          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-xl border border-white/10 bg-white/3 px-6 py-2.5 text-[15px] font-semibold text-zinc-300 transition hover:border-crimson/40 hover:text-crimson-bright"
          >
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}

function SettingsPanel({
  open,
  onClose,
  cleanBot,
  onToggleCleanBot,
}: {
  open: boolean;
  onClose: () => void;
  cleanBot: boolean;
  onToggleCleanBot: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-bold">설정</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-2.5">
            <div>
              <p className="text-[14px] font-semibold text-zinc-200">클린봇</p>
              <p className="text-[12px] text-zinc-500">
                채팅에서 비속어를 가려서 보여줍니다
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={cleanBot}
              onClick={onToggleCleanBot}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                cleanBot ? "bg-felt" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  cleanBot
                    ? "transform-[translateX(20px)]"
                    : "transform-[translateX(0)]"
                }`}
              />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Home() {
  const router = useRouter();

  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomHasPassword, setRoomHasPassword] = useState(false);

  const [playerId, setPlayerId] = useState("");

  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(MIN_ROOM_PLAYERS);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerInfo[]>([]);

  // 방 만들기 화면에서 고르는 정원 (아직 만들어진 방의 값이 아님)
  const [createMaxPlayers, setCreateMaxPlayers] = useState(MIN_ROOM_PLAYERS);

  // 방 만들기 화면에서 입력하는 방 이름/비밀번호 (아직 만들어진 방의 값이 아님)
  const [createRoomName, setCreateRoomName] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  // 방 만들기/참가 시 사용할 닉네임 (비워두면 서버가 기본 이름을 붙여준다).
  // 게스트가 입력한 값은 방 찾기 화면 등 다른 페이지에서도 쓸 수 있도록
  // 로컬에 저장해둔다.
  const [displayName, setDisplayName] = useState("");

  const [error, setError] = useState("");

  // 방 만들기/참가 요청을 보내고 서버 응답을 기다리는 동안 true.
  // 버튼을 즉시 비활성화해 중복 요청을 막고, 네트워크 왕복 중임을 보여준다.
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // 게임 종료 후 "다시하기"에 내가 동의했는지, 그리고 전체 동의 현황
  const [hasVotedRestart, setHasVotedRestart] = useState(false);
  const [restartVotes, setRestartVotes] = useState(0);
  const [restartVotesTotal, setRestartVotesTotal] = useState(0);

  // 다시하기 시 파산한 플레이어가 있으면 전원에게 한 번 뜨는 알림.
  // 내가 그 대상이면 관전/나가기를 직접 골라야 한다.
  const [bankruptcyNotice, setBankruptcyNotice] =
    useState<BankruptcyNotice | null>(null);
  const [hasDecidedBankruptcy, setHasDecidedBankruptcy] = useState(false);

  // 누군가 방을 나갔을 때 5초간 보여주는 알림 메시지
  const [leaveNotice, setLeaveNotice] = useState<string | null>(null);

  // 방 채팅 — 데스크톱에서는 항상 열려 있는 도킹 패널이고, isChatOpen은
  // 화면이 좁을 때(모바일)만 여닫는 오버레이 표시 여부로 쓰인다.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // 지금 입력 중인 상대방들(플레이어 id → 이름). 서버가 "입력 중" 신호를
  // 보낼 때마다 갱신하고, 일정 시간 갱신이 없으면(연결이 끊기는 등) 자동으로
  // 지운다.
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingExpiryTimers = useRef<Record<string, number>>({});
  // 내가 입력 중임을 서버에 이미 알렸는지 — 매 타이핑마다 다시 보내지 않고
  // "입력 시작"과 "입력 멈춤"에만 신호를 보내기 위한 상태.
  const isTypingRef = useRef(false);
  const typingStopTimer = useRef<number | null>(null);

  // 클린봇(비속어 순화) — 기본은 꺼짐이며, 로비 설정과 채팅창 안에서 모두
  // 바꿀 수 있다. 내 화면에 보이는 채팅에만 적용되는 개인 설정이라 굳이
  // 서버와 동기화하지 않고 이 브라우저에만 저장해둔다.
  //
  // 서버는 localStorage를 알 수 없으니 항상 false로 렌더링한다. 저장된
  // 값을 초기 state에서 바로 읽으면 서버가 그린 HTML(false)과 클라이언트가
  // 곧바로 그리는 값(예: true)이 달라져 하이드레이션 경고가 나므로, 마운트
  // 이후 이펙트에서 한 번만 실제 값으로 맞춘다.
  const [cleanBot, setCleanBot] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(CLEAN_BOT_STORAGE_KEY) === "1") {
      setCleanBot(true);
    }
  }, []);

  const toggleCleanBot = () => {
    setCleanBot((prev) => {
      const next = !prev;

      window.localStorage.setItem(CLEAN_BOT_STORAGE_KEY, next ? "1" : "0");

      return next;
    });
  };

  // 데스크톱에서는 채팅이 항상 보이므로 "안 읽음" 배지도 필요 없다.
  const isDesktop = useIsDesktop();

  // 소켓 리스너는 마운트 시 한 번만 등록되므로, 리스너 안에서 최신 열림
  // 상태를 읽으려면(클로저에 갇히지 않도록) ref로 따로 최신값을 유지한다.
  const isChatOpenRef = useRef(isChatOpen || isDesktop);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen || isDesktop;
  }, [isChatOpen, isDesktop]);

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [isSavingProfileName, setIsSavingProfileName] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // 로그인한 계정 — null이면 게스트. 랭킹은 로그인했을 때만 집계된다.
  const user = useAuth();

  // 프로필 페이지에서 설정한 닉네임. 없으면 구글 계정 이름으로 대체 표시한다.
  const [profileName, setProfileName] = useState<string | null>(null);

  // 로그인 계정의 지속 보유 칩(뱅크롤). 로비로 돌아올 때마다 최신값을 다시 불러온다.
  const [chips, setChips] = useState<number | null>(null);

  // 족보 선택 단계에서 아직 서버에 확정 제출하지 않은 임시 선택
  const [pendingSelection, setPendingSelection] = useState<number[]>([]);

  // 게스트가 예전에 입력해둔 닉네임이 있으면 불러온다(로그인 계정의
  // 프로필 이름이 아래 effect에서 먼저 채워졌다면 덮어쓰지 않는다).
  useEffect(() => {
    const saved = loadNickname();

    if (saved) {
      setDisplayName((prev) => prev || saved);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    getFirebaseDb().then(async (firestore) => {
      if (!firestore || cancelled) return;

      const { doc, getDoc } = await import("firebase/firestore");

      if (cancelled) return;

      try {
        const snapshot = await getDoc(
          doc(firestore, PROFILES_COLLECTION, user.uid),
        );

        if (cancelled) return;

        const profile = snapshot.data() as UserProfile | undefined;
        const name = profile?.name ?? user.displayName?.slice(0, 13) ?? null;

        setProfileName(name);
        setProfileNameDraft(name ?? "");

        if (name) {
          setDisplayName((prev) => prev || name);
        }
      } catch (err) {
        console.error("프로필을 불러오지 못했습니다:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || roomId) return;

    let cancelled = false;

    getFirebaseDb().then(async (firestore) => {
      if (!firestore || cancelled) return;

      const { doc, getDoc } = await import("firebase/firestore");

      if (cancelled) return;

      try {
        const snapshot = await getDoc(
          doc(firestore, RANKINGS_COLLECTION, user.uid),
        );

        if (cancelled) return;

        const entry = snapshot.data() as RankingEntry | undefined;

        setChips(entry?.money ?? STARTING_CHIPS);

        // 파산(0 이하)한 채로 로비에 돌아왔다면 자동으로 채워달라고 요청한다.
        // 서버가 실제로 0 이하인지 다시 확인한 뒤 지급하고 결과를 알려준다.
        if (entry && entry.money <= 0) {
          const idToken = await user.getIdToken();

          socket.emit("claim-bankruptcy-refill", { idToken });
        }
      } catch (err) {
        console.error("보유 칩을 불러오지 못했습니다:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, roomId]);

  const signOutOfGoogle = () => {
    getFirebaseAuth().then(async (auth) => {
      if (!auth) return;

      const { signOut } = await import("firebase/auth");

      signOut(auth).catch((err) => {
        console.error("로그아웃 실패:", err);
      });
    });

    setIsProfileOpen(false);
  };

  // 프로필 설정 패널에서 닉네임을 저장한다 — /profile 페이지와 같은 로직이다.
  const saveProfileName = () => {
    if (!user) return;

    const trimmed = profileNameDraft.trim().slice(0, 13);

    if (trimmed.length === 0) {
      setProfileError("이름을 입력해주세요.");
      return;
    }

    setIsSavingProfileName(true);
    setProfileError("");
    setProfileSaved(false);

    const profile: UserProfile = { name: trimmed, updatedAt: Date.now() };

    getFirebaseDb()
      .then(async (firestore) => {
        if (!firestore) return;

        const { doc, setDoc, updateDoc } = await import("firebase/firestore");

        await setDoc(doc(firestore, PROFILES_COLLECTION, user.uid), profile, {
          merge: true,
        });

        setProfileName(trimmed);
        setProfileNameDraft(trimmed);
        setDisplayName(trimmed);
        setProfileSaved(true);

        // 이미 랭킹에 기록이 있는 계정이면 표시 이름도 바로 갱신한다.
        // 아직 한 판도 안 한 계정은 랭킹 문서가 없어서 실패하는데, 그건 정상이라 무시한다.
        updateDoc(doc(firestore, RANKINGS_COLLECTION, user.uid), {
          name: trimmed,
        }).catch(() => {});
      })
      .catch((err) => {
        console.error("프로필 저장에 실패했습니다:", err);
        setProfileError("저장에 실패했습니다.");
      })
      .finally(() => {
        setIsSavingProfileName(false);
      });
  };

  useEffect(() => {
    socket.on("room-created", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setRoomName(info.name);
      setRoomHasPassword(info.hasPassword);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setRoomPlayers(info.players);
      setChatMessages(info.chatMessages);
      setError("");
      setIsSubmittingRoom(false);
      saveSession({
        roomId: info.roomId,
        playerId: info.playerId,
        rejoinToken: info.rejoinToken,
      });
    });

    socket.on("room-joined", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setRoomName(info.name);
      setRoomHasPassword(info.hasPassword);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setRoomPlayers(info.players);
      setChatMessages(info.chatMessages);
      setError("");
      setIsSubmittingRoom(false);
      saveSession({
        roomId: info.roomId,
        playerId: info.playerId,
        rejoinToken: info.rejoinToken,
      });
    });

    socket.on("rejoin-failed", () => {
      clearSession();
    });

    socket.on(
      "players-updated",
      ({
        count,
        maxPlayers,
        players,
      }: {
        count: number;
        maxPlayers: number;
        players: RoomPlayerInfo[];
      }) => {
        setPlayerCount(count);
        setMaxPlayers(maxPlayers);
        setRoomPlayers(players);
      },
    );

    socket.on("game-state", (state: ClientGameState) => {
      setGameState(state);
      setError("");
      setHasVotedRestart(false);
      setRestartVotes(0);
      setRestartVotesTotal(0);
      setBankruptcyNotice(null);
      setHasDecidedBankruptcy(false);

      if (state.phase !== "select") {
        setPendingSelection([]);
      }
    });

    socket.on(
      "restart-votes-updated",
      ({ votes, total }: { votes: number; total: number }) => {
        setRestartVotes(votes);
        setRestartVotesTotal(total);
      },
    );

    socket.on("bankruptcy-notice", (notice: BankruptcyNotice) => {
      setBankruptcyNotice(notice);
      setHasDecidedBankruptcy(false);
    });

    socket.on("player-left", ({ message }: { message: string }) => {
      setLeaveNotice(message);
    });

    socket.on("bankruptcy-refill-result", ({ money }: { money: number }) => {
      setChips(money);
    });

    socket.on("chat-message", (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);

      if (!isChatOpenRef.current) {
        setHasUnreadChat(true);
      }
    });

    socket.on(
      "chat-typing",
      ({
        playerId: typingPlayerId,
        name,
        isTyping,
      }: {
        playerId: string;
        name: string;
        isTyping: boolean;
      }) => {
        if (typingExpiryTimers.current[typingPlayerId]) {
          window.clearTimeout(typingExpiryTimers.current[typingPlayerId]);
          delete typingExpiryTimers.current[typingPlayerId];
        }

        if (isTyping) {
          setTypingUsers((prev) => ({ ...prev, [typingPlayerId]: name }));

          typingExpiryTimers.current[typingPlayerId] = window.setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };

              delete next[typingPlayerId];

              return next;
            });
          }, 3000);
        } else {
          setTypingUsers((prev) => {
            const next = { ...prev };

            delete next[typingPlayerId];

            return next;
          });
        }
      },
    );

    socket.on("error-message", ({ message }: { message: string }) => {
      setError(message);
      setHasVotedRestart(false);
      setIsSubmittingRoom(false);
    });

    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("rejoin-failed");
      socket.off("players-updated");
      socket.off("game-state");
      socket.off("restart-votes-updated");
      socket.off("bankruptcy-notice");
      socket.off("player-left");
      socket.off("bankruptcy-refill-result");
      socket.off("chat-message");
      socket.off("chat-typing");
      socket.off("error-message");

      for (const timer of Object.values(typingExpiryTimers.current)) {
        window.clearTimeout(timer);
      }

      typingExpiryTimers.current = {};
    };
  }, []);

  // 나감 알림은 5초 뒤 자동으로 닫힌다.
  useEffect(() => {
    if (!leaveNotice) return;

    const timer = window.setTimeout(() => setLeaveNotice(null), 5000);

    return () => window.clearTimeout(timer);
  }, [leaveNotice]);

  // 최소 인원 미달로 게임 시작에 실패했다는 안내도 5초 뒤 자동으로 닫힌다.
  useEffect(() => {
    if (error !== NOT_ENOUGH_PLAYERS_ERROR) return;

    const timer = window.setTimeout(() => setError(""), 5000);

    return () => window.clearTimeout(timer);
  }, [error]);

  // 마운트 시 이전에 있던 방이 저장돼 있으면 자동으로 재접속을 시도한다.
  //
  // 로그인 계정 자리는 서버가 idToken으로 uid까지 확인하므로, Firebase
  // 로그인 상태(user)가 아직 복구되지 않은 시점에 idToken 없이 보내면
  // 정당한 재접속도 실패한다. 로그인 상태가 이미 있으면 바로 시도하고,
  // 아직 없다면(게스트이거나 로그인 복구가 느린 경우) 잠시 기다렸다가
  // 그때 값으로 한 번만 시도한다 — 그사이 로그인이 복구되면 effect가
  // 다시 실행되면서 대기 중이던 시도는 취소되고 올바른 토큰으로 재시도된다.
  useEffect(() => {
    const session = loadSession();

    if (!session) return;

    let cancelled = false;
    let timer: number | undefined;

    const attemptRejoin = async () => {
      const idToken = user ? await user.getIdToken() : undefined;

      if (!cancelled) {
        socket.emit("rejoin-room", { ...session, idToken });
      }
    };

    if (user) {
      attemptRejoin();
    } else {
      timer = window.setTimeout(attemptRejoin, 700);
    }

    return () => {
      cancelled = true;

      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [user]);

  // 7. 방 만들기
  const createRoom = async () => {
    if (isSubmittingRoom) return;

    setError("");
    setIsSubmittingRoom(true);

    const idToken = user ? await user.getIdToken() : undefined;

    socket.emit("create-room", {
      maxPlayers: createMaxPlayers,
      name: displayName.trim() || undefined,
      roomName: createRoomName.trim() || undefined,
      password: createPassword.trim() || undefined,
      idToken,
    });
  };

  // 9. 게임 시작
  const startGame = () => {
    if (!roomId) return;

    if (playerCount < MIN_ROOM_PLAYERS) {
      setError(NOT_ENOUGH_PLAYERS_ERROR);
      return;
    }

    socket.emit("start-game", roomId);
  };

  // 방장이 아닌 참가자가 대기실에서 준비 상태를 켜고 끈다.
  const toggleReady = () => {
    if (!roomId) return;

    socket.emit("toggle-ready", roomId);
  };

  // 대기실에서 방장이 빈자리를 AI로 채우거나 뺀다.
  const addAiPlayer = () => {
    if (!roomId) return;

    socket.emit("add-ai-player", roomId);
  };

  const removeAiPlayer = (aiPlayerId: string) => {
    if (!roomId) return;

    socket.emit("remove-ai-player", { roomId, playerId: aiPlayerId });
  };

  // 방을 나갈 때 로컬에 남아있던 방/게임 상태를 정리한다.
  const resetRoomState = () => {
    clearSession();

    setRoomId("");
    setRoomName("");
    setRoomHasPassword(false);
    setPlayerId("");
    setGameState(null);
    setPlayerCount(0);
    setMaxPlayers(MIN_ROOM_PLAYERS);
    setRoomPlayers([]);
    setPendingSelection([]);
    setIsGuideOpen(false);
    setError("");
    setHasVotedRestart(false);
    setRestartVotes(0);
    setRestartVotesTotal(0);
    setBankruptcyNotice(null);
    setHasDecidedBankruptcy(false);
    setLeaveNotice(null);
    setChatMessages([]);
    setIsChatOpen(false);
    setHasUnreadChat(false);
    setChatInput("");
  };

  // 10. 방 나가기
  const leaveRoom = () => {
    if (!roomId) return;

    const isMidGame = !!gameState && gameState.phase !== "finished";

    if (
      isMidGame &&
      !window.confirm(
        "게임을 나가시겠습니까? 진행 중인 판은 자동으로 다이(패배) 처리되고, 이미 낸 판돈은 돌려받지 못합니다.",
      )
    ) {
      return;
    }

    socket.emit("leave-room", roomId);
    resetRoomState();
  };

  // 다시하기 투표 — 참가자 전원이 동의해야 실제로 재시작된다. AI는 항상
  // 자동으로 동의한 것으로 취급되므로, AI만 남은 상대라면 클릭 한 번으로
  // 바로 재시작된다.
  const restartGame = () => {
    if (!roomId || hasVotedRestart) return;

    setError("");
    setHasVotedRestart(true);

    socket.emit("restart-game", roomId);
  };

  // 파산했을 때 다음 판을 관전할지, 방을 나갈지 선택한다.
  const decideBankruptcy = (choice: "spectate" | "leave") => {
    if (!roomId || hasDecidedBankruptcy) return;

    setHasDecidedBankruptcy(true);
    socket.emit("bankruptcy-decision", { roomId, choice });

    if (choice === "leave") {
      resetRoomState();
    }
  };

  const call = () => {
    if (!roomId) return;

    socket.emit("call", roomId);
  };

  const check = () => {
    if (!roomId) return;

    socket.emit("check", roomId);
  };

  // 하프/쿼터/더블 — 베팅을 열 때든 레이즈할 때든 같은 액션이다. 추가로
  // 낼 금액(현재 팟 × 배율)은 서버가 계산한다.
  const raiseByRatio = (ratio: "half" | "quarter" | "double") => {
    if (!roomId) return;

    socket.emit("raise", { roomId, ratio });
  };

  // 올인 — 남은 칩을 전부 건다. 판당 최대 베팅 금액의 예외다. 서버가
  // 콜/레이즈 여부까지 판단하므로 클라이언트는 그냥 요청만 보낸다.
  const allIn = () => {
    if (!roomId) return;

    socket.emit("all-in", roomId);
  };

  const fold = () => {
    if (!roomId) return;

    socket.emit("fold", roomId);
  };

  const revealCard = (cardIndex: number) => {
    if (!roomId) return;

    socket.emit("reveal-card", {
      roomId,
      cardIndex,
    });
  };

  const toggleSelect = (cardIndex: number) => {
    setPendingSelection((prev) => {
      if (prev.includes(cardIndex)) {
        return prev.filter((index) => index !== cardIndex);
      }

      if (prev.length >= 2) {
        return prev;
      }

      return [...prev, cardIndex];
    });
  };

  const confirmSelect = () => {
    if (!roomId || pendingSelection.length !== 2) return;

    socket.emit("select-hand", {
      roomId,
      indices: pendingSelection,
    });
  };

  // 입력 중임을 상대에게 알린다 — 타이핑할 때마다 보내지 않고, "입력
  // 시작"과(1.5초간 추가 입력이 없는) "입력 멈춤" 시점에만 한 번씩 보낸다.
  const notifyTyping = () => {
    if (!roomId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("chat-typing", { roomId, isTyping: true });
    }

    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);

    typingStopTimer.current = window.setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("chat-typing", { roomId, isTyping: false });
    }, 1500);
  };

  const handleChatInputChange = (value: string) => {
    setChatInput(value);

    if (value.trim()) {
      notifyTyping();
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();

    if (!roomId || !text) return;

    socket.emit("chat-message", { roomId, text });
    setChatInput("");

    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("chat-typing", { roomId, isTyping: false });
    }
  };

  const openChat = () => {
    setIsChatOpen(true);
    setHasUnreadChat(false);
  };

  /*
   * 아직 방에 들어가지 않은 상태
   */
  if (!roomId) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-4">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRankingOpen(true)}
            className="rounded-lg border border-white/10 bg-white/3 px-3 py-1.5 text-[13.5px] font-medium text-zinc-300 transition hover:bg-white/10"
          >
            랭킹
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-lg border border-white/10 bg-white/3 px-3 py-1.5 text-[13.5px] font-medium text-zinc-300 transition hover:bg-white/10"
          >
            설정
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setProfileError("");
                  setProfileSaved(false);
                  setIsProfileOpen(true);
                }}
                className="text-[13.5px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                {profileName ?? user.displayName ?? "플레이어"}님
              </button>

              {user && chips !== null && (
                <span className="rounded-lg border border-gold/20 bg-gold/5 px-2.5 py-1 font-mono text-[13.5px] font-semibold tabular-nums text-gold-bright">
                  칩 {chips.toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <GoogleSignInButton onError={setError} />
          )}
        </div>

        <h1 className="mb-1 text-[36px] font-black tracking-tight text-gold">
          섯다
        </h1>

        <p className="mb-5 text-[17.5px] text-zinc-500">
          전통 카드 게임을 온라인으로
        </p>

        <div className="mb-4 w-full max-w-sm">
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-500">
            닉네임 (선택)
          </label>

          <input
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              saveNickname(event.target.value.trim());
            }}
            placeholder="입력하지 않으면 기본 이름이 부여됩니다"
            maxLength={13}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <div className="w-full max-w-xl">
          <div className="flex flex-col">
            {/* 7. 방 만들기 */}
            <section className="animate-fade-up flex w-full flex-col rounded-2xl border border-white/10 bg-white/3 p-5 shadow-xl shadow-black/30 sm:p-6">
              <h2 className="mb-1 text-[20px] font-bold">방 만들기</h2>

              <p className="mb-2 text-[15.5px] text-zinc-400">
                새로운 게임 방을 생성합니다.
              </p>

              <input
                value={createRoomName}
                onChange={(event) => setCreateRoomName(event.target.value)}
                placeholder="방 이름"
                maxLength={20}
                className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-[15.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              />

              <input
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                placeholder="비밀번호"
                maxLength={20}
                className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-[15.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              />

              <p className="mb-1.5 text-[14px] font-medium text-zinc-500">
                인원 수
              </p>

              <div className="mb-4 flex gap-2">
                {Array.from(
                  { length: MAX_ROOM_PLAYERS - MIN_ROOM_PLAYERS + 1 },
                  (_, index) => MIN_ROOM_PLAYERS + index,
                ).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setCreateMaxPlayers(count)}
                    className={`flex-1 rounded-lg border py-1.5 text-[16px] font-semibold transition ${
                      createMaxPlayers === count
                        ? "border-gold/60 bg-gold/15 text-gold-bright"
                        : "border-white/10 bg-white/3 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={createRoom}
                disabled={isSubmittingRoom}
                className="mt-auto w-full rounded-xl bg-gold px-6 py-3 text-[16px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isSubmittingRoom ? "만드는 중..." : "방 만들기"}
              </button>
            </section>

            {/* 8. 방 찾기 */}
            <button
              type="button"
              onClick={() => router.push("/rooms")}
              style={{ animationDelay: "80ms" }}
              className="animate-fade-up mt-2 w-full rounded-xl border border-white/15 bg-white/3 px-6 py-3 text-[16px] font-semibold text-zinc-200 transition hover:scale-[1.02] hover:border-felt/40 hover:bg-felt/10 hover:text-felt-bright active:scale-[0.98]"
            >
              방 찾기
            </button>
          </div>

          {error && (
            <p className="animate-fade-up mt-6 rounded-xl border border-crimson/30 bg-crimson/10 p-4 text-center text-[17.5px] font-medium text-crimson-bright">
              {error}
            </p>
          )}
        </div>

        <RankingModal
          open={isRankingOpen}
          onClose={() => setIsRankingOpen(false)}
        />

        {user && (
          <ProfilePanel
            open={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            email={user.email}
            name={profileNameDraft}
            onNameChange={(value) => {
              setProfileNameDraft(value);
              setProfileSaved(false);
            }}
            onSave={saveProfileName}
            saving={isSavingProfileName}
            saved={profileSaved}
            error={profileError}
            onSignOut={signOutOfGoogle}
          />
        )}

        <SettingsPanel
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          cleanBot={cleanBot}
          onToggleCleanBot={toggleCleanBot}
        />
      </main>
    );
  }

  /*
   * 방에 들어왔지만 아직 게임이 시작되지 않은 상태
   * — 코드만 덩그러니 보여주지 않고, 실제 게임 화면과 같은 테이블 구도로 대기한다.
   */
  if (!gameState) {
    const hostId = roomPlayers[0]?.id ?? null;

    // roomPlayers는 서버가 실제로 들고 있는 참가자 배열(항상 앞이
    // 채워져 있음)이므로, 인덱스로 그대로 좌석에 채워 넣는다. 좌석을
    // "player-N" id로 다시 찾아 매칭하면, 누군가(특히 AI)가 중간에
    // 빠져나가 번호에 빈틈이 생겼을 때 실제로는 채워진 자리를 빈 자리로
    // 잘못 그리게 된다.
    const seats = Array.from({ length: maxPlayers }, (_, index) => {
      const roomPlayer = roomPlayers[index];

      if (!roomPlayer) {
        return {
          id: `empty-${index}`,
          name: `플레이어 ${index + 1}`,
          isMe: false,
          filled: false,
          isHost: false,
          isReady: false,
          isAI: false,
        };
      }

      return {
        id: roomPlayer.id,
        name: roomPlayer.name,
        isMe: roomPlayer.id === playerId,
        filled: true,
        isHost: roomPlayer.id === hostId,
        isReady: roomPlayer.isReady,
        isAI: roomPlayer.isAI,
      };
    });

    const roomFull = playerCount === maxPlayers;
    const isHost = hostId === playerId;
    const myReady =
      roomPlayers.find((player) => player.id === playerId)?.isReady ?? false;
    const allOthersReady = roomPlayers
      .filter((player) => player.id !== hostId)
      .every((player) => player.isReady);
    // 인원 미달로는 버튼을 막지 않는다 — 눌렀을 때 안내 문구가 뜨도록
    // startGame()이 직접 검사한다. (다른 참가자가 아직 준비 전이라면
    // 그건 계속 버튼 자체를 막아 "전원 준비 대기 중" 문구로 안내한다.)
    const canStart = isHost && allOthersReady;

    return (
      <main className="flex h-dvh flex-col overflow-hidden px-3 py-2 sm:flex-row sm:gap-0 sm:px-6 sm:py-4">
        <LeaveNoticeToast message={leaveNotice} />

        <div className="mx-auto flex w-full min-w-0 flex-1 flex-col overflow-hidden sm:pr-4">
          <header className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="shrink-0 text-[22px] font-black tracking-tight text-gold sm:text-[26px]">
                섯다
              </h1>

              <span className="truncate text-[14px] text-zinc-500 sm:text-[15.5px]">
                {roomHasPassword ? "🔒 " : ""}
                {roomName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openChat}
                className="relative rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:hidden"
              >
                채팅
                {hasUnreadChat && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-crimson" />
                )}
              </button>

              <button
                type="button"
                onClick={leaveRoom}
                className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-400 transition hover:scale-[1.03] hover:border-crimson/40 hover:text-crimson-bright active:scale-95 sm:px-3"
              >
                나가기
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto sm:gap-4">
            <p className="text-center text-[15px] font-medium text-zinc-500 sm:text-[17.5px]">
              {playerCount} / {maxPlayers}명 참가 중
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {seats.map((seat) => (
                <SeatCard
                  key={seat.id}
                  name={seat.name}
                  isMe={seat.isMe}
                  filled={seat.filled}
                  isHost={seat.isHost}
                  isReady={seat.isReady}
                  isAI={seat.isAI}
                  onRemove={
                    isHost && seat.isAI
                      ? () => removeAiPlayer(seat.id)
                      : undefined
                  }
                />
              ))}
            </div>

            <p className="animate-fade-up text-center text-[15px] font-medium text-zinc-500 sm:text-[17.5px]">
              {roomFull
                ? "정원이 모두 찼습니다."
                : roomHasPassword
                  ? "친구에게 비밀번호를 알려주고 방 찾기에서 참가하도록 안내하세요."
                  : "친구에게 방 찾기에서 이 방을 찾아 참가하도록 안내하거나, AI를 추가해보세요."}
            </p>
          </div>

          <div className="shrink-0 pt-2">
            {/* 방장은 빈자리를 AI로 채울 수 있다 */}
            {isHost && !roomFull && (
              <button
                type="button"
                onClick={addAiPlayer}
                className="mb-2 w-full rounded-xl border border-felt/30 bg-felt/10 px-6 py-2.5 text-[15.5px] font-semibold text-felt-bright transition hover:scale-[1.02] hover:border-felt/50 hover:bg-felt/20 active:scale-[0.98]"
              >
                AI 추가
              </button>
            )}

            {/* 9. 게임 시작 / 준비 */}
            {isHost ? (
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="w-full rounded-xl bg-gold px-6 py-3 text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                게임 시작
                {playerCount < MIN_ROOM_PLAYERS
                  ? ` (최소 ${MIN_ROOM_PLAYERS}명 필요)`
                  : !allOthersReady && " (전원 준비 대기 중)"}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleReady}
                className={`w-full rounded-xl px-6 py-3 text-[17.5px] font-semibold transition hover:scale-[1.02] active:scale-[0.98] ${
                  myReady
                    ? "bg-felt text-zinc-900 hover:bg-felt-bright"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {myReady ? "준비 완료 (취소하려면 클릭)" : "준비"}
              </button>
            )}

            {error && (
              <p className="animate-fade-up mx-auto mt-2 max-w-md rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-center text-[17.5px] font-medium text-crimson-bright">
                {error}
              </p>
            )}
          </div>
        </div>

        <ChatPanel
          open={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          myPlayerId={playerId}
          input={chatInput}
          onInputChange={handleChatInputChange}
          onSend={sendChatMessage}
          typingNames={Object.values(typingUsers)}
          cleanBot={cleanBot}
          onToggleCleanBot={toggleCleanBot}
        />
      </main>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);

  const myCards: SeotdaCard[] =
    myPlayer?.cards
      .map((visibleCard) => visibleCard.card)
      .filter((card): card is SeotdaCard => !!card) ?? [];

  /*
   * 게임 화면 — 스크롤 없이 한 화면(h-dvh)에 들어오도록 세로 구성
   */
  return (
    <main className="flex h-dvh flex-col overflow-hidden px-3 py-2 sm:flex-row sm:gap-4 sm:px-6 sm:py-4">
      <LeaveNoticeToast message={leaveNotice} />

      <div className="mx-auto flex w-full min-w-0 flex-1 flex-col overflow-hidden sm:pr-4">
        <header className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
          <h1 className="text-[25px] font-bold tracking-tight text-gold sm:text-3xl">
            섯다
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:px-3"
            >
              족보 가이드
            </button>

            <button
              type="button"
              onClick={openChat}
              className="relative rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:hidden"
            >
              채팅
              {hasUnreadChat && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-crimson" />
              )}
            </button>

            <button
              type="button"
              onClick={leaveRoom}
              className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-400 transition hover:scale-[1.03] hover:border-crimson/40 hover:text-crimson-bright active:scale-95 sm:px-3"
            >
              나가기
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <GameBoard
            gameState={gameState}
            playerId={playerId}
            onRevealCard={revealCard}
            pendingSelection={pendingSelection}
            onToggleSelect={toggleSelect}
            onConfirmSelect={confirmSelect}
          />
        </div>

        <div className="shrink-0 pt-2">
          {gameState.phase === "finished" && bankruptcyNotice && (
            <div className="animate-pop-in flex flex-col items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-center">
              <p className="text-[17.5px] font-semibold text-gold-bright">
                {bankruptcyNotice.playerNames.join(", ")}님이 파산했습니다.
              </p>

              {bankruptcyNotice.playerIds.includes(playerId) ? (
                hasDecidedBankruptcy ? (
                  <p className="text-[15px] text-zinc-400">
                    선택을 처리하는 중...
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideBankruptcy("spectate")}
                      className="rounded-xl border border-white/15 bg-white/5 px-5 py-2 text-[15px] font-semibold text-zinc-200 transition hover:scale-[1.03] hover:bg-white/10 active:scale-95"
                    >
                      관전하기
                    </button>

                    <button
                      type="button"
                      onClick={() => decideBankruptcy("leave")}
                      className="rounded-xl border border-crimson/40 bg-crimson/10 px-5 py-2 text-[15px] font-semibold text-crimson-bright transition hover:scale-[1.03] hover:bg-crimson/20 active:scale-95"
                    >
                      나가기
                    </button>
                  </div>
                )
              ) : (
                <p className="text-[15px] text-zinc-400">
                  관전 또는 나가기를 선택하는 중입니다...
                </p>
              )}
            </div>
          )}

          {gameState.phase === "finished" && !bankruptcyNotice && (
            <div className="flex flex-col items-center gap-1.5 pb-1">
              <button
                type="button"
                onClick={restartGame}
                disabled={hasVotedRestart}
                className="animate-pop-in rounded-xl bg-gold px-6 py-2.5 text-[17.5px] font-semibold text-zinc-900 shadow-lg shadow-gold/20 transition hover:scale-[1.03] hover:bg-gold-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {hasVotedRestart ? "동의함 · 대기 중" : "다시 하기"}
              </button>

              <p className="text-[15px] text-zinc-500">
                {restartVotes}/{restartVotesTotal}명 동의
              </p>
            </div>
          )}

          {gameState.phase === "showdown" && gameState.redealReason && (
            <p className="animate-fade-up mx-auto max-w-md rounded-xl border border-gold/30 bg-gold/10 p-3 text-center text-[17.5px] font-semibold text-gold-bright">
              {gameState.redealReason}! 판돈은 그대로 두고 곧바로
              재경기합니다...
            </p>
          )}

          {(gameState.phase === "betting1" ||
            gameState.phase === "betting2") && (
            <div className="animate-fade-up grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
              {gameState.currentBet === 0 ? (
                <button
                  type="button"
                  onClick={check}
                  disabled={
                    gameState.players[gameState.currentPlayerIndex]?.id !==
                    playerId
                  }
                  className="rounded-xl border border-white/15 bg-white/3 px-5 py-2.5 text-[17.5px] font-semibold text-zinc-200 transition hover:scale-[1.03] hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                >
                  체크
                </button>
              ) : (
                <button
                  type="button"
                  onClick={call}
                  disabled={
                    gameState.players[gameState.currentPlayerIndex]?.id !==
                    playerId
                  }
                  className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                >
                  콜
                </button>
              )}

              <button
                type="button"
                onClick={() => raiseByRatio("half")}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
              >
                하프
              </button>

              <button
                type="button"
                onClick={() => raiseByRatio("quarter")}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
              >
                쿼터
              </button>

              <button
                type="button"
                onClick={() => raiseByRatio("double")}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="rounded-xl bg-gold px-5 py-2.5 text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-gold-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
              >
                더블
              </button>

              <button
                type="button"
                onClick={allIn}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="rounded-xl bg-ember/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-ember active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
              >
                올인
              </button>

              <button
                type="button"
                onClick={fold}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="rounded-xl border border-crimson/40 bg-crimson/10 px-5 py-2.5 text-[17.5px] font-semibold text-crimson-bright transition hover:scale-[1.02] hover:bg-crimson/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
              >
                다이
              </button>
            </div>
          )}

          {error && (
            <p className="animate-fade-up mx-auto mt-2 max-w-md rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-center text-[17.5px] font-medium text-crimson-bright">
              {error}
            </p>
          )}
        </div>
      </div>

      <HandGuidePanel
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        myCards={myCards}
        selectedIndices={myPlayer?.selectedIndices ?? null}
      />

      <ChatPanel
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myPlayerId={playerId}
        input={chatInput}
        onInputChange={handleChatInputChange}
        onSend={sendChatMessage}
        typingNames={Object.values(typingUsers)}
        cleanBot={cleanBot}
        onToggleCleanBot={toggleCleanBot}
      />
    </main>
  );
}
