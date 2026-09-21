"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  BankruptcyNotice,
  ChatMessage,
  ClientGameState,
  ClientPlayer,
  RoomPlayerInfo,
  SeotdaCard,
  VisibleCard,
} from "@/types/seotda";
import { HAND_GUIDE, SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { evaluateHand, getDisplayHandName } from "@/lib/seotda/ranking";
import { RaiseRatio } from "@/lib/seotda/bettingRound";
import { computeBettingAmounts } from "@/lib/seotda/bettingDisplay";
import { MIN_ROOM_PLAYERS } from "@/lib/seotda/constants";
import { playBetActionSound } from "@/lib/sound";
import { useIsDesktop } from "@/lib/useIsDesktop";

// compact: 상대방 카드처럼 화면 공간을 아끼는 작은 크기 / cozy: 내 카드처럼 강조되는 큰 크기
type CardSize = "compact" | "cozy";

// sm/lg 같은 고정 구간마다 뚝뚝 끊겨 커지는 대신, 뷰포트 폭에 비례해
// 연속적으로 커지도록 clamp()로 정의했다 — 창 크기를 드래그하면 카드가
// 계단식이 아니라 부드럽게 늘어난다.
const CARD_SIZE_CLASS: Record<CardSize, string> = {
  compact: "w-[clamp(2.25rem,3vw,3rem)]",
  cozy: "w-[clamp(3.5rem,6vw,6rem)]",
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

// 유니코드 이모지 공식 그룹(Smileys & Emotion, People & Body, Component,
// Animals & Nature, Food & Drink, Travel & Places, Activities, Objects,
// Symbols, Flags) 체계를 그대로 따르되, 카드 게임 채팅창에서 감당 가능한
// 분량으로 그룹별 대표 이모지를 추려 담았다. icon은 탭 버튼에 쓰는
// 대표 이모지다.
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "스마일리",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "🤣",
      "😂",
      "🙂",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😋",
      "🤔",
      "😐",
      "🙄",
      "😴",
      "😮",
      "😱",
      "😭",
      "😢",
      "😠",
      "🤯",
      "🥳",
      "🥺",
      "😳",
      "🤫",
    ],
  },
  {
    label: "사람",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "✋",
      "👌",
      "🤌",
      "✌️",
      "🤞",
      "🤟",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "👍",
      "👎",
      "✊",
      "👊",
      "👏",
      "🙌",
      "🙏",
      "💪",
      "🦾",
      "👀",
      "👄",
      "💋",
      "🧠",
      "👣",
      "🤝",
      "🫡",
      "🧑",
    ],
  },
  {
    label: "구성",
    icon: "🦰",
    emojis: ["🦰", "🦱", "🦳", "🦲", "🫱", "🫲"],
  },
  {
    label: "동물·자연",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🦉",
      "🐺",
      "🦄",
      "🐝",
      "🦋",
      "🐢",
      "🐍",
      "🐙",
      "🌸",
      "🌻",
      "🍀",
      "🌈",
      "⭐",
    ],
  },
  {
    label: "음식",
    icon: "🍔",
    emojis: [
      "🍏",
      "🍎",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🥑",
      "🌽",
      "🍞",
      "🧀",
      "🍖",
      "🍗",
      "🍔",
      "🍟",
      "🍕",
      "🌭",
      "🌮",
      "🍣",
      "🍦",
      "🍩",
      "🎂",
      "🍫",
      "🍭",
      "☕",
      "🍵",
      "🍺",
      "🍷",
      "🥂",
    ],
  },
  {
    label: "여행",
    icon: "✈️",
    emojis: [
      "🚗",
      "🚕",
      "🚌",
      "🚑",
      "🚒",
      "🚲",
      "✈️",
      "🚀",
      "🚁",
      "⛵",
      "🚢",
      "🚂",
      "🗽",
      "🗼",
      "🏰",
      "🎡",
      "🎢",
      "🏖️",
      "🏝️",
      "🏔️",
      "🌋",
      "⛺",
      "🏠",
      "🌃",
      "🌉",
      "🌍",
      "🌌",
      "🎆",
    ],
  },
  {
    label: "활동",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🎾",
      "🏐",
      "🎱",
      "🏓",
      "🏸",
      "🥊",
      "🎯",
      "🎣",
      "🎿",
      "🎮",
      "🎲",
      "🎰",
      "🎳",
      "🎭",
      "🎨",
      "🎬",
      "🎤",
      "🎧",
      "🎹",
      "🥁",
      "🎸",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
    ],
  },
  {
    label: "사물",
    icon: "💡",
    emojis: [
      "⌚",
      "📱",
      "💻",
      "🖥️",
      "📷",
      "📺",
      "⏰",
      "🔋",
      "💡",
      "🔦",
      "📖",
      "📚",
      "💰",
      "💵",
      "💳",
      "💎",
      "🔨",
      "🔧",
      "⚙️",
      "🔑",
      "🔒",
      "💊",
      "🎁",
      "🧧",
      "🎈",
      "📌",
      "✂️",
      "🪙",
    ],
  },
  {
    label: "기호",
    icon: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "💔",
      "💕",
      "💯",
      "✅",
      "❌",
      "❗",
      "❓",
      "🔥",
      "✨",
      "⭐",
      "💫",
      "♠️",
      "♥️",
      "♦️",
      "♣️",
      "🀄",
      "🎴",
      "🆗",
      "🆕",
      "🔞",
      "㊙️",
      "㊗️",
    ],
  },
  {
    label: "깃발",
    icon: "🏁",
    emojis: [
      "🏁",
      "🚩",
      "🎌",
      "🏳️",
      "🏳️‍🌈",
      "🇰🇷",
      "🇺🇸",
      "🇯🇵",
      "🇨🇳",
      "🇬🇧",
      "🇫🇷",
      "🇩🇪",
      "🇪🇸",
      "🇮🇹",
      "🇨🇦",
      "🇦🇺",
      "🇧🇷",
      "🇮🇳",
      "🇷🇺",
    ],
  },
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
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  myPlayerId: string;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  typingNames: string[];
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [emojiCategoryIndex, setEmojiCategoryIndex] = useState(0);

  // 이모지 패널의 기준점(입력창 위 아이콘+입력 줄) — 채팅 패널 자체가
  // overflow-hidden이라(접기 애니메이션 때문에 필요) 그 안에 그냥
  // 절대배치하면 패널 폭보다 넓은 이모지 팝업이 잘려 보인다. 그래서 이
  // 기준점의 화면 좌표를 읽어 팝업을 portal로 body에 fixed 배치한다.
  const emojiAnchorRef = useRef<HTMLDivElement | null>(null);
  const [emojiPopupPos, setEmojiPopupPos] = useState<{
    bottom: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    // 닫혀 있을 땐 좌표를 다시 계산할 필요가 없다 — 렌더링 쪽에서 이미
    // isEmojiOpen으로 걸러내므로, 여기서 굳이 null로 되돌리지 않아도 된다.
    if (!isEmojiOpen) return;

    const updatePosition = () => {
      const rect = emojiAnchorRef.current?.getBoundingClientRect();

      if (!rect) return;

      setEmojiPopupPos({
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right + 10,
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isEmojiOpen]);
  // 데스크톱에서 채팅이 비어있을 때도 화면의 상당 부분을 늘 차지하는 게
  // 문제로 지적돼, 도킹된 상태에서도 폭을 좁은 아이콘 레일로 접을 수 있게
  // 했다. 모바일 오버레이의 열림/닫힘(open)과는 별개 개념이다.
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  // 데스크톱에서는 채팅이 항상 화면에 붙박이로 보이므로 open 상태와
  // 무관하게 늘 조작 가능해야 한다 — 모바일일 때만 open이 실제 표시 여부다.
  const isVisible = isDesktop || open;
  const isDockCollapsed = isDesktop && isCollapsed;

  // 패널이 보이거나 새 메시지가 도착하면 항상 맨 아래로 스크롤한다.
  useEffect(() => {
    if (!isVisible || isDockCollapsed) return;

    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [isVisible, isDockCollapsed, messages]);

  // 데스크톱(sm 이상)에서는 레이아웃에 자리를 차지하는 도킹 패널로,
  // 모바일에서는 문서 흐름 밖의 fixed 오버레이로 오른쪽에서 슬라이드인한다.
  return (
    <aside
      // 모바일에서 닫혀 있는 동안에는 화면 밖으로 밀려나 있는 안의
      // 입력창/버튼이 키보드 탭 이동으로 포커스되지 않도록 inert 처리한다.
      // 데스크톱에서는 항상 보이므로 inert를 걸지 않는다.
      inert={!isVisible}
      className={`z-40 flex shrink-0 flex-col overflow-hidden border-white/10 bg-zinc-950/95 transition-[width,transform] duration-300 sm:relative sm:translate-x-0 sm:border-l sm:bg-zinc-950/60 sm:shadow-none ${
        isDockCollapsed ? "sm:w-12" : "w-56 sm:w-[clamp(14rem,22vw,20rem)]"
      } ${
        open
          ? "fixed inset-y-0 right-0 translate-x-0 border-l shadow-2xl"
          : "fixed inset-y-0 right-0 translate-x-full border-l shadow-2xl"
      }`}
    >
      {isDockCollapsed ? (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="채팅 펼치기"
          className="flex h-full w-full flex-col items-center justify-center gap-3 py-6 text-zinc-500 transition hover:text-gold-bright"
        >
          <span className="text-[18px]">💬</span>
          <span className="text-[12.5px] font-semibold tracking-widest [writing-mode:vertical-rl]">
            채팅
          </span>
        </button>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:py-4">
            <h3 className="text-[17.5px] font-bold sm:text-[22.5px]">채팅</h3>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                aria-label="채팅 접기"
                title="채팅 접기"
                className="hidden rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                »
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
                      isMine
                        ? "bg-gold text-zinc-900"
                        : "bg-white/8 text-zinc-100"
                    }`}
                  >
                    {message.text}
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
                  : " "}
            </p>
          </div>

          <div ref={emojiAnchorRef} className="relative shrink-0">
            {isEmojiOpen &&
              emojiPopupPos &&
              createPortal(
                <div
                  style={{
                    bottom: emojiPopupPos.bottom,
                    right: emojiPopupPos.right,
                  }}
                  className="fixed z-50 w-72 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl"
                >
                  <div className="flex gap-0.5 overflow-x-auto border-b border-white/10 p-1.5">
                    {EMOJI_CATEGORIES.map((category, index) => (
                      <button
                        key={category.label}
                        type="button"
                        title={category.label}
                        aria-label={category.label}
                        aria-pressed={emojiCategoryIndex === index}
                        onClick={() => setEmojiCategoryIndex(index)}
                        className={`shrink-0 rounded-lg px-2 py-1 text-[16px] transition ${
                          emojiCategoryIndex === index
                            ? "bg-gold/15 ring-1 ring-gold/40"
                            : "hover:bg-white/10"
                        }`}
                      >
                        {category.icon}
                      </button>
                    ))}
                  </div>

                  <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto p-2">
                    {EMOJI_CATEGORIES[emojiCategoryIndex].emojis.map(
                      (emoji, index) => (
                        <button
                          key={`${emoji}-${index}`}
                          type="button"
                          onClick={() => {
                            onInputChange(`${input}${emoji}`);
                            setIsEmojiOpen(false);
                          }}
                          className="rounded-lg py-1 text-[19px] transition hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ),
                    )}
                  </div>
                </div>,
                document.body,
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
                className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] px-3 py-2 text-[13.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20 sm:px-3.5 sm:py-2.5 sm:text-[15px]"
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
        </>
      )}
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

// 실제 카지노 칩처럼, 금액 구간마다 다른 색의 칩 한 종류를 대응시킨다.
// 던지는 칩의 색(PlayerPanel)과 판돈 무더기(ChipStack)에 표시하는 색·숫자가
// 모두 이 표를 공유해 항상 같은 색은 같은 액수를 뜻하게 한다. 내림차순으로
// 두어 chipDenominationFor()가 "이 금액이 속하는 가장 큰 단위"를 찾는다.
// side는 두께(옆면)를 표현하는 box-shadow용 어두운 색이다.
const CHIP_DENOMINATIONS = [
  {
    value: 10_000,
    label: "1만",
    bg: "bg-crimson",
    border: "border-crimson-bright",
    side: "#8a3a2c",
  },
  {
    value: 5_000,
    label: "5천",
    bg: "bg-ember",
    border: "border-gold-bright",
    side: "#a35a1f",
  },
  {
    value: 1_000,
    label: "1천",
    bg: "bg-gold",
    border: "border-gold-bright",
    side: "#a67d3a",
  },
  {
    value: 500,
    label: "500",
    bg: "bg-felt",
    border: "border-felt-bright",
    side: "#2b6640",
  },
  {
    value: 100,
    label: "100",
    bg: "bg-zinc-400",
    border: "border-zinc-300",
    side: "#6b7078",
  },
] as const;

function chipDenominationFor(amount: number) {
  return (
    CHIP_DENOMINATIONS.find((d) => amount >= d.value) ??
    CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1]
  );
}

const CHIP_PILE_SIZE = 28;
// 칩의 두께(옆면 높이) — box-shadow로 칩 아래에 진한 색 띠를 깔아,
// 위(윗면)와 옆(옆면)이 함께 보이는 원통형 칩처럼 보이게 한다.
const CHIP_PILE_THICKNESS = 6;
// 가로 간격을 칩 지름보다 넉넉히 크게 둬서, 종류(단위)가 다른 칩끼리는
// 옆면(그림자)까지 포함해도 절대 서로 겹치지 않게 한다 — 세로 간격은
// 계단처럼 올라가는 느낌만 주면 되므로 그보다 작아도 된다.
const CHIP_PILE_H_STEP = 35;
const CHIP_PILE_V_STEP = 18;
// 맨 아래(0번) 칩의 그림자(옆면 두께 + 번짐)는 그 칩 자신의 박스 밑으로
// 삐져나오는데, 그 칩이 컨테이너 맨 아래에 딱 붙어 있으면 이 그림자가
// 컨테이너 밖으로, 즉 바로 밑의 POT 박스 쪽으로 새어나간다. 모든 칩을
// 이만큼 위로 올려 그 여백을 컨테이너 안에 미리 확보해둔다.
const CHIP_PILE_SHADOW_RESERVE = CHIP_PILE_THICKNESS + 6;

// 판돈 규모에 따라, 그 금액이 걸쳐 있는 단위의 칩들을 사선으로 쌓아 올린
// 무더기 그림이다 — 정확한 금액은 항상 바로 아래 텍스트로 표기하므로, 이
// 그림은 판돈이 얼마나 두둑한지 눈대중으로 보여주는 용도일 뿐이다. 낮은
// 단위일수록 왼쪽 아래, 높은 단위일수록 오른쪽 위로 계단처럼 쌓아, 각
// 칩의 윗면(숫자)과 옆면(두께)이 함께 드러나게 한다.
function ChipStack({ amount }: { amount: number }) {
  const denominations = CHIP_DENOMINATIONS.filter(
    (d) => amount >= d.value,
  ).reverse();

  if (denominations.length === 0) return null;

  const width = CHIP_PILE_SIZE + (denominations.length - 1) * CHIP_PILE_H_STEP;
  const height =
    CHIP_PILE_SIZE +
    CHIP_PILE_SHADOW_RESERVE +
    (denominations.length - 1) * CHIP_PILE_V_STEP;

  return (
    <div className="relative" style={{ width, height }} aria-hidden>
      {denominations.map((d, index) => (
        <span
          key={d.value}
          className={`absolute flex items-center justify-center rounded-full border-2 font-mono text-[11px] leading-none font-bold text-zinc-900 ${d.bg} ${d.border}`}
          style={{
            width: CHIP_PILE_SIZE,
            height: CHIP_PILE_SIZE,
            left: index * CHIP_PILE_H_STEP,
            bottom: index * CHIP_PILE_V_STEP + CHIP_PILE_SHADOW_RESERVE,
            zIndex: index,
            // 왼쪽 위에서 빛을 받는 듯한 하이라이트 + 가장자리를 따라 도는
            // 얇은 점선형 테두리로, 평면 원이 아니라 광택 있는 실물 칩처럼
            // 보이게 한다.
            backgroundImage: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), repeating-conic-gradient(rgba(255,255,255,0.4) 0deg 6deg, transparent 6deg 18deg)`,
            backgroundBlendMode: "overlay, normal",
            boxShadow: `0 ${CHIP_PILE_THICKNESS}px 0 0 ${d.side}, 0 ${
              CHIP_PILE_THICKNESS + 2
            }px 5px rgba(0,0,0,0.4), inset 0 0 0 3px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.4)`,
          }}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

function PotBadge({ pot, turnLabel }: { pot: number; turnLabel: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 py-1">
      <ChipStack amount={pot} />

      <div
        className="flex flex-col items-center rounded-2xl border border-gold/40 bg-zinc-950/80 px-5 py-1.5 sm:px-6 sm:py-2"
        style={{
          boxShadow:
            "0 0 24px -4px rgba(219, 169, 90, 0.35), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.5)",
        }}
      >
        <p className="text-[10px] font-bold tracking-widest text-gold-bright sm:text-[11px]">
          POT
        </p>

        <p
          key={pot}
          className="animate-pop-in font-mono text-[17.5px] font-bold tabular-nums text-gold sm:text-[22px]"
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
  soundEffects: boolean;
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
  soundEffects,
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

  // 베팅액이 늘어날 때마다(콜/하프/쿼터/더블/올인 — 체크·다이는 베팅액이
  // 바뀌지 않으므로 해당 없음) 칩 하나가 팟 방향으로 튀어 나가는 짧은
  // 애니메이션과 함께 딸깍 소리를 재생한다. 라운드가 바뀌며 베팅액이
  // 0으로 리셋되는 것은 "베팅"이 아니므로, 늘어날 때만 반응한다. 이 값이
  // 나(isMe)든 상대든 똑같이 적용돼, 누가 얼마를 걸든 그 자리에서 바로
  // 반응이 보이고 들린다.
  const prevBetRef = useRef(player.bet);
  const nextChipIdRef = useRef(0);
  const [flyingChips, setFlyingChips] = useState<
    { id: number; amount: number }[]
  >([]);

  useEffect(() => {
    if (player.bet > prevBetRef.current) {
      const id = ++nextChipIdRef.current;
      // 이번에 새로 걸린 만큼(총 베팅액이 아니라 이번 행동으로 늘어난
      // 증가분)에 맞춰 칩 색을 고른다 — 얼마를 던졌는지가 색으로 보인다.
      const amount = player.bet - prevBetRef.current;

      setFlyingChips((prev) => [...prev, { id, amount }]);

      if (soundEffects) {
        playBetActionSound(player.lastAction);
      }

      // onAnimationEnd가 어떤 이유로든(예: prefers-reduced-motion로 애니메이션
      // 자체가 꺼진 경우) 발동하지 않을 때를 대비한 안전장치.
      window.setTimeout(() => {
        setFlyingChips((prev) => prev.filter((chip) => chip.id !== id));
      }, 900);
    }

    prevBetRef.current = player.bet;
  }, [player.bet, player.lastAction, soundEffects]);

  const removeFlyingChip = (id: number) => {
    setFlyingChips((prev) => prev.filter((chip) => chip.id !== id));
  };

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
            <span className="relative shrink-0 font-mono text-[15px] tabular-nums text-zinc-500">
              베팅{" "}
              <span className="text-zinc-300">
                {player.bet.toLocaleString()}
              </span>
              {flyingChips.map(({ id, amount }) => {
                const denom = chipDenominationFor(amount);

                return (
                  <span
                    key={id}
                    aria-hidden
                    onAnimationEnd={() => removeFlyingChip(id)}
                    className={`pointer-events-none absolute top-0 left-1/2 h-8 w-8 rounded-full border-2 shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_0_0_3px_rgba(0,0,0,0.25)] ${denom.bg} ${denom.border} ${
                      compact
                        ? "animate-chip-toss-down"
                        : "animate-chip-toss-up"
                    }`}
                  />
                );
              })}
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
          title="빼기"
          className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[17px] leading-none transition hover:scale-110 hover:border-crimson/40 hover:bg-crimson/10 active:scale-95"
        >
          ❌
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
  soundEffects: boolean;
}

function GameBoard({
  gameState,
  playerId,
  onRevealCard,
  pendingSelection,
  onToggleSelect,
  onConfirmSelect,
  soundEffects,
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
    <div className="table-felt relative flex flex-1 flex-col justify-between gap-[clamp(0.5rem,1.2vw,0.75rem)] rounded-4xl border border-gold/20 p-[clamp(0.625rem,2vw,1.5rem)]">
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
                soundEffects={soundEffects}
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
          soundEffects={soundEffects}
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

export interface GameRoomViewProps {
  roomName: string;
  roomHasPassword: boolean;
  playerId: string;
  playerCount: number;
  maxPlayers: number;
  roomPlayers: RoomPlayerInfo[];
  gameState: ClientGameState | null;
  error: string;
  leaveNotice: string | null;
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  hasUnreadChat: boolean;
  chatInput: string;
  typingUsers: Record<string, string>;
  isGuideOpen: boolean;
  pendingSelection: number[];
  soundEffects: boolean;
  hasVotedRestart: boolean;
  restartVotes: number;
  restartVotesTotal: number;
  bankruptcyNotice: BankruptcyNotice | null;
  hasDecidedBankruptcy: boolean;
  onAddAiPlayer: () => void;
  onRemoveAiPlayer: (playerId: string) => void;
  onStartGame: () => void;
  onToggleReady: () => void;
  onLeaveRoom: () => void;
  onOpenChat: () => void;
  onCloseChat: () => void;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  onRevealCard: (cardIndex: number) => void;
  onToggleSelect: (cardIndex: number) => void;
  onConfirmSelect: () => void;
  onJoinNextRound: () => void;
  onDecideBankruptcy: (choice: "spectate" | "leave") => void;
  onRestartGame: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaiseByRatio: (ratio: RaiseRatio) => void;
  onAllIn: () => void;
  onFold: () => void;
}

export default function GameRoomView({
  roomName,
  roomHasPassword,
  playerId,
  playerCount,
  maxPlayers,
  roomPlayers,
  gameState,
  error,
  leaveNotice,
  chatMessages,
  isChatOpen,
  hasUnreadChat,
  chatInput,
  typingUsers,
  isGuideOpen,
  pendingSelection,
  soundEffects,
  hasVotedRestart,
  restartVotes,
  restartVotesTotal,
  bankruptcyNotice,
  hasDecidedBankruptcy,
  onAddAiPlayer,
  onRemoveAiPlayer,
  onStartGame,
  onToggleReady,
  onLeaveRoom,
  onOpenChat,
  onCloseChat,
  onOpenGuide,
  onCloseGuide,
  onChatInputChange,
  onSendChat,
  onRevealCard,
  onToggleSelect,
  onConfirmSelect,
  onJoinNextRound,
  onDecideBankruptcy,
  onRestartGame,
  onCheck,
  onCall,
  onRaiseByRatio,
  onAllIn,
  onFold,
}: GameRoomViewProps) {
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
              <h1 className="font-serif shrink-0 text-[22px] font-black tracking-tight text-gold sm:text-[26px]">
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
                onClick={onOpenChat}
                className="relative rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:hidden"
              >
                채팅
                {hasUnreadChat && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-crimson" />
                )}
              </button>

              <button
                type="button"
                onClick={onLeaveRoom}
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
                      ? () => onRemoveAiPlayer(seat.id)
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
                onClick={onAddAiPlayer}
                className="mb-2 w-full rounded-xl border border-felt/30 bg-felt/10 px-6 py-2.5 text-[15.5px] font-semibold text-felt-bright transition hover:scale-[1.02] hover:border-felt/50 hover:bg-felt/20 active:scale-[0.98]"
              >
                AI 추가
              </button>
            )}

            {/* 9. 게임 시작 / 준비 */}
            {isHost ? (
              <button
                type="button"
                onClick={onStartGame}
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
                onClick={onToggleReady}
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
          onClose={onCloseChat}
          messages={chatMessages}
          myPlayerId={playerId}
          input={chatInput}
          onInputChange={onChatInputChange}
          onSend={onSendChat}
          typingNames={Object.values(typingUsers)}
        />
      </main>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);

  const myCards: SeotdaCard[] =
    myPlayer?.cards
      .map((visibleCard) => visibleCard.card)
      .filter((card): card is SeotdaCard => !!card) ?? [];

  const bettingAmounts = myPlayer
    ? computeBettingAmounts(gameState.pot, gameState.currentBet, myPlayer)
    : null;

  const isMyTurn =
    gameState.players[gameState.currentPlayerIndex]?.id === playerId;

  const infoRailPhaseLabel =
    PHASE_LABEL[gameState.phase] ??
    (gameState.phase === "betting1" || gameState.phase === "betting2"
      ? "베팅 중"
      : gameState.phase);

  /*
   * 게임 화면 — 스크롤 없이 한 화면(h-dvh)에 들어오도록 세로 구성
   */
  return (
    <main className="flex h-dvh flex-col overflow-hidden px-3 py-2 sm:flex-row sm:gap-4 sm:px-6 sm:py-4">
      <LeaveNoticeToast message={leaveNotice} />

      {/* 노트북/데스크톱처럼 넓은 화면에서는 채팅을 접어도 테이블 반대편에
          빈 공간이 남는다 — 그 공간을 장식이 아니라 실제 있는 정보(방·내
          현황)를 상시 보여주는 패널로 채운다. xl 미만에서는 아예 렌더링하지
          않아 좁은 화면 레이아웃에는 영향이 없다. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-3 xl:flex">
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <p className="mb-1 truncate text-[15px] font-semibold text-zinc-200">
            {roomHasPassword ? "🔒 " : ""}
            {roomName}
          </p>
          <p className="text-[13px] text-zinc-500">
            {gameState.players.length}/{maxPlayers}명 참가 중
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <p className="mb-3 text-[12px] font-semibold tracking-wide text-zinc-500">
            내 현황
          </p>

          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[13.5px] text-zinc-400">보유 칩</span>
            <span className="font-mono text-[16px] font-bold tabular-nums text-gold-bright">
              {(myPlayer?.chips ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-[13.5px] text-zinc-400">이번 판 팟</span>
            <span className="font-mono text-[16px] font-bold tabular-nums text-gold-bright">
              {gameState.pot.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gold/15 bg-gold/4 p-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright" />
          <p className="text-[13.5px] font-medium text-zinc-300">
            {infoRailPhaseLabel}
          </p>
        </div>
      </aside>

      <div className="mx-auto flex w-full min-w-0 flex-1 flex-col overflow-hidden sm:pr-4 2xl:max-w-350">
        <header className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
          <h1 className="font-serif text-[25px] font-bold tracking-tight text-gold sm:text-3xl">
            섯다
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenGuide}
              className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:px-3"
            >
              족보 가이드
            </button>

            <button
              type="button"
              onClick={onOpenChat}
              className="relative rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-[15px] font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-gold/40 hover:text-gold-bright active:scale-95 sm:hidden"
            >
              채팅
              {hasUnreadChat && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-crimson" />
              )}
            </button>

            <button
              type="button"
              onClick={onLeaveRoom}
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
            onRevealCard={onRevealCard}
            pendingSelection={pendingSelection}
            onToggleSelect={onToggleSelect}
            onConfirmSelect={onConfirmSelect}
            soundEffects={soundEffects}
          />
        </div>

        <div className="shrink-0 pt-2">
          {myPlayer?.isSpectator && (
            <div className="mb-2 flex flex-col items-center gap-1.5">
              {myPlayer.pendingActivation ? (
                <p className="animate-fade-up rounded-xl border border-felt/30 bg-felt/10 px-4 py-2 text-center text-[15px] font-medium text-felt-bright">
                  다음 판부터 참가합니다. 이번 판이 끝날 때까지 기다려주세요.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onJoinNextRound}
                  className="animate-fade-up rounded-xl bg-felt/90 px-6 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.02] hover:bg-felt active:scale-95"
                >
                  경기 참여
                </button>
              )}
            </div>
          )}

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
                      onClick={() => onDecideBankruptcy("spectate")}
                      className="rounded-xl border border-white/15 bg-white/5 px-5 py-2 text-[15px] font-semibold text-zinc-200 transition hover:scale-[1.03] hover:bg-white/10 active:scale-95"
                    >
                      관전하기
                    </button>

                    <button
                      type="button"
                      onClick={() => onDecideBankruptcy("leave")}
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

          {gameState.phase === "finished" &&
            !bankruptcyNotice &&
            !myPlayer?.isSpectator && (
              <div className="flex flex-col items-center gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={onRestartGame}
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

          {(gameState.phase === "betting1" || gameState.phase === "betting2") &&
            !myPlayer?.isSpectator &&
            bettingAmounts && (
              <>
                <p className="mb-1.5 text-center text-[13px] text-zinc-500 sm:text-[14px]">
                  이번 판 베팅 한도{" "}
                  <span className="font-mono text-zinc-300">
                    {bettingAmounts.totalBet.toLocaleString()}
                  </span>
                  {" / "}
                  <span className="font-mono text-zinc-300">
                    {bettingAmounts.maxBet.toLocaleString()}
                  </span>
                  {" · 남은 여유 "}
                  <span className="font-mono font-semibold text-gold-bright">
                    {bettingAmounts.remainingRoom.toLocaleString()}
                  </span>
                </p>

                <div className="animate-fade-up grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
                  {gameState.currentBet === 0 ? (
                    <button
                      type="button"
                      onClick={onCheck}
                      disabled={!isMyTurn}
                      className="rounded-xl border border-white/15 bg-white/3 px-5 py-2.5 text-[17.5px] font-semibold text-zinc-200 transition hover:scale-[1.03] hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                    >
                      체크
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onCall}
                      disabled={
                        !isMyTurn ||
                        bettingAmounts.callAmount >
                          bettingAmounts.allInAmount ||
                        bettingAmounts.callAmount > bettingAmounts.remainingRoom
                      }
                      className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                    >
                      콜 {bettingAmounts.callAmount.toLocaleString()}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRaiseByRatio("half")}
                    disabled={
                      !isMyTurn ||
                      bettingAmounts.raiseAmounts.half <= 0 ||
                      bettingAmounts.raiseAmounts.half >
                        bettingAmounts.allInAmount ||
                      bettingAmounts.raiseAmounts.half >
                        bettingAmounts.remainingRoom
                    }
                    className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    하프 {bettingAmounts.raiseAmounts.half.toLocaleString()}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRaiseByRatio("quarter")}
                    disabled={
                      !isMyTurn ||
                      bettingAmounts.raiseAmounts.quarter <= 0 ||
                      bettingAmounts.raiseAmounts.quarter >
                        bettingAmounts.allInAmount ||
                      bettingAmounts.raiseAmounts.quarter >
                        bettingAmounts.remainingRoom
                    }
                    className="rounded-xl bg-felt/90 px-5 py-2.5 text-[17.5px] font-semibold transition hover:scale-[1.03] hover:bg-felt active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    쿼터 {bettingAmounts.raiseAmounts.quarter.toLocaleString()}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRaiseByRatio("double")}
                    disabled={
                      !isMyTurn ||
                      bettingAmounts.raiseAmounts.double <= 0 ||
                      bettingAmounts.raiseAmounts.double >
                        bettingAmounts.allInAmount ||
                      bettingAmounts.raiseAmounts.double >
                        bettingAmounts.remainingRoom
                    }
                    className="rounded-xl bg-gold px-5 py-2.5 text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-gold-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    더블 {bettingAmounts.raiseAmounts.double.toLocaleString()}
                  </button>

                  {/* 올인은 되돌릴 수 없는 가장 큰 액션이라, 다른 버튼보다 한 단계
                      크고 은은하게 맥동하는 테두리를 둬 눈에 먼저 들어오게 한다. */}
                  <button
                    type="button"
                    onClick={onAllIn}
                    disabled={!isMyTurn || bettingAmounts.allInAmount <= 0}
                    className="animate-allin-glow rounded-xl border-2 border-gold-bright/30 bg-ember px-6 py-3 text-[18px] font-black text-white transition hover:scale-[1.04] hover:bg-ember active:scale-95 disabled:cursor-not-allowed disabled:animate-none disabled:opacity-30 disabled:hover:scale-100 sm:px-9 sm:py-3.5 sm:text-[21px]"
                  >
                    올인 {bettingAmounts.allInAmount.toLocaleString()}
                  </button>

                  {/* 다이는 포기하는 액션이라, 나머지 그룹과 시각적으로 거리를
                      두고(왼쪽 여백) 기본 상태에서는 옅게 눌러둔다. */}
                  <button
                    type="button"
                    onClick={onFold}
                    disabled={!isMyTurn}
                    className="rounded-xl border border-crimson/30 px-5 py-2.5 text-[15.5px] font-medium text-crimson-bright/80 transition hover:scale-[1.02] hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson-bright active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:ml-2 sm:px-7 sm:py-3 sm:text-[16px]"
                  >
                    다이
                  </button>
                </div>
              </>
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
        onClose={onCloseGuide}
        myCards={myCards}
        selectedIndices={myPlayer?.selectedIndices ?? null}
      />

      <ChatPanel
        open={isChatOpen}
        onClose={onCloseChat}
        messages={chatMessages}
        myPlayerId={playerId}
        input={chatInput}
        onInputChange={onChatInputChange}
        onSend={onSendChat}
        typingNames={Object.values(typingUsers)}
      />
    </main>
  );
}
