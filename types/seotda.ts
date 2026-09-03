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
  // 이번 판(1차+2차 베팅 라운드 전체)에 걸쳐 누적된 베팅액 — maxBet과
  // 함께, 이번 판에 더 낼 수 있는 여유(베팅 한도)를 계산하는 데 쓰인다.
  totalBet: number;
  // 이번 판 개인별 최대 베팅 상한(판마다 참가자 전원의 보유 칩 평균으로
  // 정해짐). 올인은 이 상한의 예외라 이 값을 넘어설 수 있다.
  maxBet: number;
  lastAction: string | null;
  // 파산 후 관전을 선택한 플레이어인지
  isSpectator: boolean;
  // 방장이 "AI 추가"로 채운 컴퓨터 플레이어인지
  isAI: boolean;
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
  isReady: boolean;
  // 방장이 "AI 추가"로 채운 컴퓨터 플레이어인지 — true면 대기실에서
  // 준비 상태 대신 AI 표시와(방장에게는) 빼기 버튼을 보여준다.
  isAI: boolean;
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
  // 방 목록에 표시되는 이름 — 방장이 정하지 않았으면 서버가 기본값을 붙인다.
  name: string;
  // 이 방에 비밀번호가 걸려 있는지 — 원문은 클라이언트로 전달되지 않는다.
  hasPassword: boolean;
  playerId: string;
  // 새로고침 등으로 끊긴 뒤 rejoin-room으로 같은 자리를 되찾을 때 본인임을
  // 증명하는 값. 서버만 발급하며, 다른 플레이어에게는 전달되지 않는다.
  rejoinToken: string;
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayerInfo[];
  chatMessages: ChatMessage[];
}

// 로비 화면에 뜨는 방 하나의 요약 정보. list-rooms 요청에 대한 응답으로
// 받으며, 모든 방이 항상 뜨고 hasPassword로 잠긴 방만 구분한다. 이미
// 게임이 시작된 방도 정원이 차지 않았다면 그대로 노출되며, 그런 방에
// 입장하면 이번 판은 관전만 하고 다음 판부터 실제로 참여하게 된다.
export interface RoomListEntry {
  roomId: string;
  name: string;
  hasPassword: boolean;
  playerCount: number;
  maxPlayers: number;
  // 게임이 이미 시작되어 진행 중인 방인지 — true면 입장 시 이번 판은
  // 관전만 하고 다음 판부터 실제로 참여한다.
  inProgress: boolean;
}
