export type CardType = "light" | "ten" | "dan" | "pi";

export interface SeotdaCard {
  id: string;
  month: number;
  type: CardType;
  name: string;
}

export type PlayerStatus = "playing" | "folded" | "winner" | "loser";

export interface VisibleCard {
  id: string;
  revealed: boolean;
  card?: SeotdaCard;
}

export interface ClientPlayer {
  id: string;
  name: string;
  cards: VisibleCard[];
  handName: string | null;
  revealedCardIndex: number | null;
  selectedIndices: [number, number] | null;
  hasSelectedHand: boolean;
  status: PlayerStatus;
  chips: number;
  bet: number;
  lastAction: string | null;
  // 파산 후 관전을 선택한 플레이어인지
  isSpectator: boolean;
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

// 플레이어마다 보유 칩(개인별 최대 베팅 상한)이 달라 올인 시점도 서로 다르면
// 팟이 메인 팟과 사이드 팟으로 나뉜다. eligiblePlayerIds는 그 팟을 받을 수
// 있는(=다이하지 않고 그 금액까지 낸) 플레이어 id 목록이다.
export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface ClientGameState {
  phase: GamePhase;

  players: ClientPlayer[];

  currentPlayerIndex: number;
  pot: number;
  currentBet: number;
  winnerId: string | null;
  // 구사/멍텅구리 구사로 재경기가 진행되는 짧은 동안(phase가 "showdown")만
  // 값이 채워진다 — 재경기는 앤티·베팅 변화 없이 그 자리에서 즉시 진행된다.
  redealReason: string | null;
  // 쇼다운/종료 시점에 확정되는 팟 구성. 베팅이 끝나기 전에는 null이다.
  pots: Pot[] | null;
}

export interface RestartVotesInfo {
  votes: number;
  total: number;
  votedPlayerIds: string[];
}

// 다시하기 시 파산한 플레이어가 있을 때 전원에게 한 번 알려주는 정보.
// playerIds에 자신이 포함돼 있으면 관전/나가기를 직접 선택해야 한다.
export interface BankruptcyNotice {
  playerIds: string[];
  playerNames: string[];
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  timestamp: number;
}

export interface RoomInfo {
  roomId: string;
  playerId: string;
  // 새로고침 등으로 끊긴 뒤 rejoin-room으로 같은 자리를 되찾을 때 본인임을
  // 증명하는 값. 서버만 발급하며, 다른 플레이어에게는 전달되지 않는다.
  rejoinToken: string;
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayerInfo[];
  chatMessages: ChatMessage[];
}
