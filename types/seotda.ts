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
  | "redeal"
  | "finished";

export interface ClientGameState {
  phase: GamePhase;

  players: ClientPlayer[];

  currentPlayerIndex: number;
  pot: number;
  currentBet: number;
  winnerId: string | null;
  redealReason: string | null;
  // 구사류 재경기가 거듭될수록 배로 불어나는 다음 판 앤티 배수
  nextAnteMultiplier: number;
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
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayerInfo[];
  chatMessages: ChatMessage[];
}
