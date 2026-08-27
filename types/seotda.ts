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
}

export interface RestartVotesInfo {
  votes: number;
  total: number;
  votedPlayerIds: string[];
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
}

export interface RoomInfo {
  roomId: string;
  playerId: string;
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayerInfo[];
}
