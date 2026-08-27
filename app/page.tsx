"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { io, Socket } from "socket.io-client";
import {
  ClientGameState,
  ClientPlayer,
  RoomInfo,
  SeotdaCard,
  VisibleCard,
} from "@/types/seotda";
import { HAND_GUIDE, SPECIAL_HAND_GUIDE } from "@/lib/seotda/handGuide";
import { evaluateHand } from "@/lib/seotda/ranking";

// 개발 모드의 Fast Refresh로 이 모듈이 다시 실행돼도
// 소켓 연결이 중복 생성되지 않도록 globalThis에 캐시한다.
const socketCache = globalThis as unknown as { __seotdaSocket?: Socket };

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

const socket: Socket =
  socketCache.__seotdaSocket ??
  (socketCache.__seotdaSocket = io(SOCKET_URL));

const SESSION_STORAGE_KEY = "seotda-session";

const MIN_ROOM_PLAYERS = 2;
const MAX_ROOM_PLAYERS = 6;

interface StoredSession {
  roomId: string;
  playerId: string;
}

function saveSession(session: StoredSession) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

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
      className={`animate-card-in relative aspect-2/3 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-lg shadow-black/40 ${CARD_SIZE_CLASS[size]}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Image
        src={`/card/${card.id}.png`}
        alt={card.name}
        fill
        sizes="(min-width: 1024px) 80px, (min-width: 640px) 64px, 44px"
        className="object-cover"
      />

      <span className="absolute top-0.5 left-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-black/70 px-0.5 text-[9px] font-bold text-white">
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
      <span className="text-lg font-bold text-white/30 sm:text-2xl">?</span>
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

const SPECIAL_HAND_NAME_MAP: Record<string, string> = {
  gusa: "구사",
  "meongtunguri-gusa": "멍텅구리 구사",
  ddaengjabi: "땡잡이",
  "amhaeng-eosa": "암행어사",
};

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
      specialNames.add(SPECIAL_HAND_NAME_MAP[result.special]);
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
          <h3 className="text-lg font-semibold">족보 가이드</h3>

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
          <p className="mb-2 text-xs font-semibold tracking-wide text-amber-400">
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
                      ? "border-amber-400/60 bg-amber-400/10 ring-1 ring-amber-400/40"
                      : "border-white/5 bg-white/3"
                  }`}
                >
                  <div className="flex gap-1">
                    <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                    <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {entry.name}
                      {isMine && (
                        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                          내 패
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">{entry.months}</p>
                    <p className="text-xs text-emerald-400">{entry.effect}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mb-2 text-xs font-semibold tracking-wide text-amber-400">
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
                      ? "border-amber-400/60 bg-amber-400/10 ring-1 ring-amber-400/40"
                      : "border-white/5 bg-white/3"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-zinc-400">
                    {index + 1}
                  </span>

                  <div className="flex gap-1">
                    <MiniCard cardId={entry.cardIds[0]} alt={entry.name} />
                    <MiniCard cardId={entry.cardIds[1]} alt={entry.name} />
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {entry.name}
                      {isMine && (
                        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                          내 패
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">{entry.months}</p>
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

function RoomCodeBadge({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard API 사용 불가");
      }

      await navigator.clipboard.writeText(roomId);
    } catch {
      // Clipboard API를 쓸 수 없는 환경(HTTP 등)을 위한 폴백
      const textarea = document.createElement("textarea");

      textarea.value = roomId;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="방 코드 복사"
      className={`rounded-lg border px-2.5 py-1 text-right transition hover:scale-[1.03] active:scale-95 sm:px-3 ${
        copied
          ? "border-emerald-400/40 bg-emerald-400/10"
          : "border-white/10 bg-white/3 hover:border-amber-400/40"
      }`}
    >
      <span className="block text-[9px] text-zinc-500 sm:text-[10px]">
        방 코드{" "}
      </span>
      <span
        className={`text-xs font-bold tracking-widest sm:text-sm ${
          copied ? "text-emerald-300" : ""
        }`}
      >
        {copied ? "복사됨" : roomId}
      </span>
    </button>
  );
}

// 카드 3장 중 족보로 쓸 수 있는 2장의 조합(3가지)과 각 조합의 족보를 계산한다.
const CARD_PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
];

function getPossibleHands(cards: VisibleCard[]) {
  return CARD_PAIRS.filter(([i, j]) => cards[i]?.card && cards[j]?.card).map(
    ([i, j]) => ({
      indices: [i, j] as [number, number],
      name: evaluateHand([
        cards[i].card as SeotdaCard,
        cards[j].card as SeotdaCard,
      ]).name,
    }),
  );
}

const PHASE_LABEL: Partial<Record<ClientGameState["phase"], string>> = {
  reveal: "카드 공개 단계",
  select: "족보 선택 단계",
  showdown: "쇼다운",
  redeal: "재경기",
  finished: "게임 종료",
};

function PotBadge({ pot, turnLabel }: { pot: number; turnLabel: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-0.5">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/30 bg-linear-to-b from-amber-400/10 to-transparent shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)] sm:h-16 sm:w-16">
        <div className="text-center leading-tight">
          <p
            key={pot}
            className="animate-pop-in text-xs font-bold text-amber-400 sm:text-sm"
          >
            {pot.toLocaleString()}
          </p>

          <p className="text-[8px] font-semibold tracking-widest text-zinc-500">
            POT
          </p>
        </div>
      </div>

      <p className="text-xs font-medium text-zinc-400 sm:text-sm">
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
      } ${
        isMe
          ? "border-amber-400/25 bg-amber-400/4"
          : "border-white/10 bg-white/3"
      } ${
        isCurrent
          ? "animate-turn-glow ring-2 ring-amber-400/70 ring-offset-2 ring-offset-zinc-950"
          : ""
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400/80 to-amber-600/80 font-bold text-zinc-900 ${
              compact ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm sm:h-9 sm:w-9"
            }`}
          >
            {player.name.charAt(0)}
          </div>

          <h2
            className={
              compact
                ? "text-sm font-semibold"
                : "text-base font-semibold sm:text-lg"
            }
          >
            {player.name}

            {isMe && (
              <span className="ml-2 text-xs font-medium text-emerald-400">
                나
              </span>
            )}
          </h2>

          <span className="text-xs text-zinc-500">
            칩 {player.chips.toLocaleString()}
          </span>

          {player.bet > 0 && (
            <span className="text-xs text-zinc-500">
              베팅{" "}
              <span className="text-zinc-300">
                {player.bet.toLocaleString()}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCurrent && (
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-zinc-900">
              차례
            </span>
          )}

          {phase === "finished" && player.status === "winner" && (
            <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              승리
            </span>
          )}

          {phase === "finished" && player.status === "loser" && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-zinc-400">
              패배
            </span>
          )}

          {phase === "finished" && player.status === "folded" && (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-zinc-400">
              다이
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
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950"
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
                  <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                    공개됨
                  </span>
                )}

                {player.selectedIndices?.includes(index) && (
                  <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                    족보로 선택됨
                  </span>
                )}

                {canRevealNow && index !== player.revealedCardIndex && (
                  <button
                    type="button"
                    onClick={() => onRevealCard(index)}
                    className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-900 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
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
              className="animate-pop-in flex flex-col items-center justify-center rounded-xl border border-amber-400/20 bg-black/20 px-3 py-1.5 text-center sm:px-4"
            >
              <p className="text-[9px] font-medium text-zinc-400">
                {isMe ? "내 족보" : `${player.name}의 족보`}
              </p>
              <p className="text-lg font-bold text-amber-300 sm:text-xl">
                {player.handName}
              </p>
            </div>
          )}
      </div>

      {isMe &&
        player.cards.length === 3 &&
        player.cards.every((visibleCard) => visibleCard.card) && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {getPossibleHands(player.cards).map(({ indices, name }) => (
              <span
                key={`${indices[0]}-${indices[1]}`}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400"
              >
                {indices[0] + 1}+{indices[1] + 1}{" "}
                <span className="font-semibold text-zinc-200">{name}</span>
              </span>
            ))}
          </div>
        )}

      {canRevealNow && (
        <p className="mt-1.5 text-center text-sm text-amber-300">
          상대에게 보여줄 카드 한 장을 골라주세요.
        </p>
      )}

      {isMe && phase === "reveal" && player.revealedCardIndex !== null && (
        <p className="mt-1.5 text-center text-sm text-zinc-400">
          상대의 선택을 기다리는 중...
        </p>
      )}

      {canSelectNow && (
        <div className="mt-1.5 text-center">
          <p className="mb-1.5 text-sm text-amber-300">
            족보로 쓸 카드 2장을 골라주세요. ({pendingSelection.length}/2)
          </p>

          <button
            type="button"
            onClick={onConfirmSelect}
            disabled={pendingSelection.length !== 2}
            className="rounded-xl bg-amber-400 px-5 py-1.5 text-sm font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            족보 확정
          </button>
        </div>
      )}

      {isMe && phase === "select" && player.hasSelectedHand && (
        <p className="mt-1.5 text-center text-sm text-zinc-400">
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
}: {
  name: string;
  isMe: boolean;
  filled: boolean;
}) {
  if (!filled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/2 px-6 py-6 text-center sm:py-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/20 text-sm text-zinc-600 sm:h-10 sm:w-10">
          ?
        </div>

        <p className="text-sm text-zinc-500">상대방을 기다리는 중...</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border px-6 py-6 text-center sm:py-8 ${
        isMe
          ? "border-amber-400/25 bg-amber-400/4"
          : "border-white/10 bg-white/3"
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-amber-400/80 to-amber-600/80 text-sm font-bold text-zinc-900 sm:h-10 sm:w-10">
        {name.charAt(0)}
      </div>

      <p className="text-sm font-semibold">
        {name}

        {isMe && (
          <span className="ml-1.5 text-xs font-medium text-emerald-400">
            나
          </span>
        )}
      </p>
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
    <div className="flex flex-1 flex-col justify-center gap-2 sm:gap-3">
      {opponents.length > 0 && (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto sm:space-y-2">
          {opponents.map((opponent) => (
            <PlayerPanel
              key={opponent.id}
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
          ))}
        </div>
      )}

      <PotBadge pot={gameState.pot} turnLabel={turnLabel} />

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

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [playerId, setPlayerId] = useState("");

  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(MIN_ROOM_PLAYERS);

  // 방 만들기 화면에서 고르는 정원 (아직 만들어진 방의 값이 아님)
  const [createMaxPlayers, setCreateMaxPlayers] = useState(MIN_ROOM_PLAYERS);

  const [error, setError] = useState("");

  // 게임 종료 후 "다시하기"에 내가 동의했는지, 그리고 전체 동의 현황
  const [hasVotedRestart, setHasVotedRestart] = useState(false);
  const [restartVotes, setRestartVotes] = useState(0);
  const [restartVotesTotal, setRestartVotesTotal] = useState(0);

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // 상대방이 참가하면 자동 시작까지 남은 초 (null이면 카운트다운 중이 아님)
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(
    null,
  );

  // 족보 선택 단계에서 아직 서버에 확정 제출하지 않은 임시 선택
  const [pendingSelection, setPendingSelection] = useState<number[]>([]);

  useEffect(() => {
    socket.on("room-created", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setError("");
      saveSession({ roomId: info.roomId, playerId: info.playerId });
    });

    socket.on("room-joined", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setError("");
      saveSession({ roomId: info.roomId, playerId: info.playerId });
    });

    socket.on("rejoin-failed", () => {
      clearSession();
    });

    socket.on(
      "players-updated",
      ({ count, maxPlayers }: { count: number; maxPlayers: number }) => {
        setPlayerCount(count);
        setMaxPlayers(maxPlayers);

        if (count < MIN_ROOM_PLAYERS) {
          setError("함께할 플레이어가 부족합니다.");
        }
      },
    );

    socket.on("game-state", (state: ClientGameState) => {
      setGameState(state);
      setError("");
      setHasVotedRestart(false);
      setRestartVotes(0);
      setRestartVotesTotal(0);

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

    socket.on("error-message", ({ message }: { message: string }) => {
      setError(message);
      setHasVotedRestart(false);
    });

    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("rejoin-failed");
      socket.off("players-updated");
      socket.off("game-state");
      socket.off("restart-votes-updated");
      socket.off("error-message");
    };
  }, []);

  // 마운트 시 이전에 있던 방이 저장돼 있으면 자동으로 재접속을 시도한다.
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!saved) return;

    try {
      const session = JSON.parse(saved) as StoredSession;

      if (session.roomId && session.playerId) {
        socket.emit("rejoin-room", session);
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    }
  }, []);

  // 방이 정원만큼 차면 10초 카운트다운을 시작하고, 방을 나가거나
  // 게임이 이미 시작되면(gameState 생김) 취소한다.
  useEffect(() => {
    if (playerCount < MIN_ROOM_PLAYERS || playerCount !== maxPlayers || gameState) {
      setAutoStartCountdown(null);
      return;
    }

    setAutoStartCountdown(10);

    const intervalId = window.setInterval(() => {
      setAutoStartCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [playerCount, maxPlayers, gameState]);

  // 카운트다운이 0에 도달하면 자동으로 게임을 시작한다.
  useEffect(() => {
    if (autoStartCountdown === 0) {
      socket.emit("start-game", roomId);
    }
  }, [autoStartCountdown, roomId]);

  // 7. 방 만들기
  const createRoom = () => {
    setError("");

    socket.emit("create-room", createMaxPlayers);
  };

  // 8. 방 참가
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();

    if (!code) {
      setError("방 코드를 입력해주세요.");
      return;
    }

    setError("");

    socket.emit("join-room", code);
  };

  // 9. 게임 시작
  const startGame = () => {
    if (!roomId) return;

    socket.emit("start-game", roomId);
  };

  // 10. 방 나가기
  const leaveRoom = () => {
    if (!roomId) return;

    const isMidGame = !!gameState && gameState.phase !== "finished";

    if (
      isMidGame &&
      !window.confirm(
        "게임을 나가시겠습니까? 진행 중인 게임은 저장되지 않습니다.",
      )
    ) {
      return;
    }

    socket.emit("leave-room", roomId);
    clearSession();

    setRoomId("");
    setPlayerId("");
    setGameState(null);
    setPlayerCount(0);
    setMaxPlayers(MIN_ROOM_PLAYERS);
    setPendingSelection([]);
    setIsGuideOpen(false);
    setError("");
    setHasVotedRestart(false);
    setRestartVotes(0);
    setRestartVotesTotal(0);
  };

  // 다시하기 투표 — 참가자 전원이 동의해야 실제로 재시작된다.
  const restartGame = () => {
    if (!roomId || hasVotedRestart) return;

    setError("");
    setHasVotedRestart(true);

    socket.emit("restart-game", roomId);
  };

  const bet = () => {
    if (!roomId) return;

    socket.emit("bet", {
      roomId,
      amount: 100,
    });
  };

  const call = () => {
    if (!roomId) return;

    socket.emit("call", roomId);
  };

  const check = () => {
    if (!roomId) return;

    socket.emit("check", roomId);
  };

  const raise = () => {
    if (!roomId || !gameState) return;

    socket.emit("raise", {
      roomId,
      amount: gameState.currentBet + 100,
    });
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

  /*
   * 아직 방에 들어가지 않은 상태
   */
  if (!roomId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <h1 className="mb-1 text-4xl font-bold tracking-tight text-amber-400">
          섯다
        </h1>

        <p className="mb-10 text-sm text-zinc-500">
          전통 카드 게임을 온라인으로
        </p>

        <div className="w-full max-w-2xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
            {/* 7. 방 만들기 */}
            <section className="animate-fade-up w-full rounded-2xl border border-white/10 bg-white/3 p-6 shadow-xl shadow-black/30 sm:flex-1 sm:p-8">
              <h2 className="mb-1 text-lg font-semibold">방 만들기</h2>

              <p className="mb-3 text-sm text-zinc-400">
                새로운 게임 방을 생성합니다.
              </p>

              <p className="mb-2 text-xs font-medium text-zinc-500">
                인원 수
              </p>

              <div className="mb-5 flex gap-2">
                {Array.from(
                  { length: MAX_ROOM_PLAYERS - MIN_ROOM_PLAYERS + 1 },
                  (_, index) => MIN_ROOM_PLAYERS + index,
                ).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setCreateMaxPlayers(count)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                      createMaxPlayers === count
                        ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
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
                className="w-full rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-amber-300 active:scale-[0.98]"
              >
                방 만들기
              </button>
            </section>

            {/* 8. 방 참가 */}
            <section
              className="animate-fade-up w-full rounded-2xl border border-white/10 bg-white/3 p-6 shadow-xl shadow-black/30 sm:flex-1 sm:p-8"
              style={{ animationDelay: "80ms" }}
            >
              <h2 className="mb-4 text-lg font-semibold">방 참가</h2>

              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    joinRoom();
                  }
                }}
                placeholder="방 코드 입력"
                maxLength={6}
                className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-lg font-semibold tracking-[0.3em] text-white outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20"
              />

              <button
                type="button"
                onClick={joinRoom}
                className="w-full rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
              >
                참가
              </button>
            </section>
          </div>

          {error && (
            <p className="animate-fade-up mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm font-medium text-red-300">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  /*
   * 방에 들어왔지만 아직 게임이 시작되지 않은 상태
   * — 코드만 덩그러니 보여주지 않고, 실제 게임 화면과 같은 테이블 구도로 대기한다.
   */
  if (!gameState) {
    const seats = Array.from({ length: maxPlayers }, (_, index) => {
      const seatId = `player-${index + 1}`;

      return {
        id: seatId,
        name: `플레이어 ${index + 1}`,
        isMe: seatId === playerId,
        filled: index + 1 <= playerCount,
      };
    });

    const roomFull = playerCount === maxPlayers;
    const canStart = playerCount >= MIN_ROOM_PLAYERS;

    return (
      <main className="flex h-dvh flex-col overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
          <header className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
            <h1 className="text-xl font-bold tracking-tight text-amber-400 sm:text-2xl">
              섯다
            </h1>

            <div className="flex items-center gap-2">
              <RoomCodeBadge roomId={roomId} />

              <button
                type="button"
                onClick={leaveRoom}
                className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition hover:scale-[1.03] hover:border-red-500/40 hover:text-red-300 active:scale-95 sm:px-3"
              >
                나가기
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto sm:gap-4">
            <p className="text-center text-xs font-medium text-zinc-500 sm:text-sm">
              {playerCount} / {maxPlayers}명 참가 중
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {seats.map((seat) => (
                <SeatCard
                  key={seat.id}
                  name={seat.name}
                  isMe={seat.isMe}
                  filled={seat.filled}
                />
              ))}
            </div>

            <p className="animate-fade-up text-center text-xs font-medium text-zinc-500 sm:text-sm">
              {roomFull ? (
                <>
                  정원이 모두 찼습니다.
                  {autoStartCountdown !== null && (
                    <>
                      {" "}
                      <span
                        key={autoStartCountdown}
                        className="animate-pop-in font-bold text-amber-400"
                      >
                        {autoStartCountdown}초
                      </span>{" "}
                      후 자동 시작
                    </>
                  )}
                </>
              ) : (
                "친구에게 방 코드를 알려주고 초대하세요."
              )}
            </p>
          </div>

          <div className="shrink-0 pt-2">
            {/* 9. 게임 시작 */}
            <button
              type="button"
              onClick={startGame}
              disabled={!canStart}
              className="w-full rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              게임 시작{!canStart && ` (최소 ${MIN_ROOM_PLAYERS}명 필요)`}
            </button>

            {error && (
              <p className="animate-fade-up mx-auto mt-2 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-medium text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
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
    <main className="flex h-dvh flex-col overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        <header className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
          <h1 className="text-xl font-bold tracking-tight text-amber-400 sm:text-2xl">
            섯다
          </h1>

          <div className="flex items-center gap-2">
            <RoomCodeBadge roomId={roomId} />

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:scale-[1.03] hover:border-amber-400/40 hover:text-amber-300 active:scale-95 sm:px-3"
            >
              족보 가이드
            </button>

            <button
              type="button"
              onClick={leaveRoom}
              className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition hover:scale-[1.03] hover:border-red-500/40 hover:text-red-300 active:scale-95 sm:px-3"
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
          {gameState.phase === "finished" && (
            <div className="flex flex-col items-center gap-1.5 pb-1">
              <button
                type="button"
                onClick={restartGame}
                disabled={hasVotedRestart}
                className="animate-pop-in rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-amber-400/20 transition hover:scale-[1.03] hover:bg-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {hasVotedRestart ? "동의함 · 대기 중" : "다시 하기"}
              </button>

              <p className="text-xs text-zinc-500">
                {restartVotes}/{restartVotesTotal}명 동의
              </p>
            </div>
          )}

          {gameState.phase === "redeal" && (
            <p className="animate-fade-up mx-auto max-w-md rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center text-sm font-semibold text-amber-300">
              {gameState.redealReason ?? "구사"}! 무승부로 카드를 다시
              나눕니다...
            </p>
          )}

          {(gameState.phase === "betting1" ||
            gameState.phase === "betting2") && (
            <div className="animate-fade-up grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
              {gameState.currentBet === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={bet}
                    disabled={
                      gameState.players[gameState.currentPlayerIndex]?.id !==
                      playerId
                    }
                    className="rounded-xl bg-blue-500/90 px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.03] hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    베트
                  </button>

                  <button
                    type="button"
                    onClick={check}
                    disabled={
                      gameState.players[gameState.currentPlayerIndex]?.id !==
                      playerId
                    }
                    className="rounded-xl border border-white/15 bg-white/3 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:scale-[1.03] hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    체크
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={call}
                    disabled={
                      gameState.players[gameState.currentPlayerIndex]?.id !==
                      playerId
                    }
                    className="rounded-xl bg-blue-500/90 px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.03] hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    콜
                  </button>

                  <button
                    type="button"
                    onClick={raise}
                    disabled={
                      gameState.players[gameState.currentPlayerIndex]?.id !==
                      playerId
                    }
                    className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:scale-[1.03] hover:bg-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:px-7 sm:py-3"
                  >
                    레이즈
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={fold}
                disabled={
                  gameState.players[gameState.currentPlayerIndex]?.id !==
                  playerId
                }
                className="col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:scale-[1.02] hover:bg-red-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 sm:col-span-1 sm:px-7 sm:py-3"
              >
                다이
              </button>
            </div>
          )}

          {error && (
            <p className="animate-fade-up mx-auto mt-2 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-medium text-red-300">
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
    </main>
  );
}
