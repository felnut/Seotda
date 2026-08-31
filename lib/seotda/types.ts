import { Deck } from "./deck";
import { Pot, SeotdaCard } from "@/types/seotda";

// game.ts(오케스트레이션) · bettingRound.ts · potManager.ts · rematchResolver.ts가
// 공통으로 참조하는 서버 내부 도메인 타입. 여러 모듈이 서로를 가리키는 순환
// 참조 없이 이 타입들을 함께 쓸 수 있도록 별도 파일로 둔다.

export type PlayerStatus = "playing" | "folded" | "winner" | "loser";

export interface Player {
  id: string;
  name: string;
  cards: SeotdaCard[] | null;
  revealedCardIndex: number | null;
  selectedIndices: [number, number] | null;
  status: PlayerStatus;
  chips: number;
  // 이번 베팅 라운드에서만 유지되는 베팅액 — 라운드가 바뀌면 0으로 되돌아간다.
  bet: number;
  // 이번 판(1차+2차 베팅 라운드 전체)에 걸쳐 누적된 베팅액. 라운드가
  // 바뀌어도 리셋되지 않으며, maxBet 상한 판정과 사이드 팟 계산의 기준이 된다.
  totalBet: number;
  // 이번 판 개인별 최대 베팅 상한 — min(앤티 × 10, 앤티 납부 직후 보유 칩).
  // 앤티 징수 직후 한 번만 계산되며 판이 끝날 때까지 바뀌지 않는다.
  maxBet: number;
  // 이번 판에 실제로 납부한 앤티(칩 부족으로 일부만 냈을 수 있음) — 사이드
  // 팟을 계산할 때 totalBet과 합쳐 "이번 판에 낸 총액"으로 쓰인다.
  anteHandPaid: number;
  // 이번 베팅 라운드에서 마지막으로 취한 행동 (화면 표시용)
  lastAction: string | null;
  // 파산 후 관전을 선택한 플레이어 — 이후 판부터 카드도, 베팅도 하지 않는다.
  isSpectator: boolean;
  // 방을 나간 플레이어 — 화면 목록에서 완전히 제외된다. (isSpectator와 달리
  // "관전 중"으로 표시되지 않고, 다시 들어올 수도 없다.)
  hasLeft: boolean;
}

export type GamePhase =
  | "waiting"
  | "dealing"
  | "betting1"
  | "reveal"
  | "betting2"
  | "select"
  | "showdown"
  | "finished";

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  pot: number;
  currentBet: number;
  deck: Deck;
  winnerId: string | null;
  // 구사/멍텅구리 구사로 재경기가 될 때 그 사유 — phase가 "showdown"인 동안만
  // (재경기가 즉시 다시 진행되는 짧은 사이에) 의미가 있다.
  redealReason: string | null;
  // 쇼다운/폴드 종료 시점에 확정되는 팟 구성(메인 팟 + 사이드 팟). 베팅이
  // 끝나기 전에는 null이며, 베팅 중에는 state.pot(누적 총액)만 의미가 있다.
  pots: Pot[] | null;
}
