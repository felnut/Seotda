import { Deck } from "./deck";
import {
  compareHandResults,
  evaluateHand,
  findPrioritySpecialWinner,
  HAND_RANK,
  HandResult,
} from "./ranking";
import { Pot, SeotdaCard } from "@/types/seotda";

export type PlayerStatus = "playing" | "folded" | "winner" | "loser";

export const STARTING_CHIPS = 10_000;

// 매 판 시작 시 자동으로 내는 시작금(앤티)
export const ANTE = 100;

// 땡값 — 광땡/장땡으로 이겼을 때 대결한 상대 각자에게서 추가로 받는,
// 딴 금액(판돈) 대비 비율
export const GWANGDDAENG_FEE_RATE = 0.05;
export const JANGDDAENG_FEE_RATE = 0.01;

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

export class SeotdaGame {
  private state: GameState;

  // 이번 베팅 라운드에서 행동을 완료한 플레이어
  private actedPlayers = new Set<string>();

  // 이번 베팅 라운드에서 마지막으로 인정된 "완전한" 레이즈의 증가폭.
  // 다음 레이즈는 최소한 이만큼은 더 올려야 한다(최소 레이즈 규칙) — 그래야
  // 1칩씩 레이즈를 반복해 상대의 행동을 계속 다시 요구하며 진행을 지연시키는
  // 것을 막을 수 있다. 라운드를 여는 첫 베팅의 금액이 그 라운드의 기준이
  // 되며, 올인이 이 기준에 못 미치는 "불완전한" 레이즈이면 갱신하지 않는다.
  private lastRaiseIncrement = 0;

  // 구사/멍텅구리 구사로 재경기가 결정됐지만, 아직 패를 공개해서 보여주는
  // 중이라 실제 재경기 처리를 미뤄둔 상태. activePlayerIds(다이하지 않은
  // 참가자만)에게 베팅·앤티 없이 새 카드 2장만 다시 배분해 곧바로 재대결한다.
  private pendingRedeal: {
    reason: string;
    activePlayerIds: string[];
  } | null = null;

  constructor(
    players: { name: string; chips?: number }[] = [
      { name: "플레이어 1" },
      { name: "플레이어 2" },
    ],
  ) {
    this.state = {
      phase: "waiting",

      players: players.map((player, index) => ({
        id: `player-${index + 1}`,
        name: player.name,
        cards: null,
        revealedCardIndex: null,
        selectedIndices: null,
        status: "playing",
        chips: player.chips ?? STARTING_CHIPS,
        bet: 0,
        totalBet: 0,
        maxBet: 0,
        anteHandPaid: 0,
        lastAction: null,
        isSpectator: false,
        hasLeft: false,
      })),

      currentPlayerIndex: 0,
      pot: 0,
      currentBet: 0,

      deck: new Deck(),

      winnerId: null,
      redealReason: null,
      pots: null,
    };
  }

  getState(): GameState {
    return this.state;
  }

  /**
   * @param resetChips "다시하기"로 새 게임을 시작할 때(true)는 칩을 시작 금액으로
   * 되돌린다. 구사 재경기 등 같은 게임 중 재딜일 때(기본값 false)는 기존 칩을
   * 그대로 유지한다.
   */
  start(resetChips: boolean = false): void {
    if (this.state.phase !== "waiting" && this.state.phase !== "finished") {
      throw new Error("이미 시작된 게임입니다.");
    }

    // 이전 판의 승자가 다음 판의 선(첫 베팅 순서)이 된다.
    // 승자가 없었다면(첫 판) 기존처럼 0번부터 시작한다.
    const previousWinnerId = this.state.winnerId;

    this.state.deck.reset();
    this.state.pot = 0;

    this.state.currentBet = 0;
    this.state.winnerId = null;
    this.state.redealReason = null;
    this.state.pots = null;

    this.actedPlayers.clear();
    this.lastRaiseIncrement = 0;

    for (const player of this.state.players) {
      player.cards = null;
      player.revealedCardIndex = null;
      player.selectedIndices = null;
      // 관전자는 파산 후 관전을 선택한 플레이어 — 계속 관전 상태를 유지한다.
      player.status = player.isSpectator ? "folded" : "playing";
      player.bet = 0;
      player.totalBet = 0;
      player.maxBet = 0;
      player.anteHandPaid = 0;
      player.lastAction = null;

      if (resetChips) {
        player.chips = STARTING_CHIPS;
      }
    }

    // 시작금(앤티) 자동 징수 — 칩이 부족하면 있는 만큼만 낸다(파산 처리는
    // 베팅 단계에서 자동으로 진행된다). 관전자는 앤티를 내지 않는다.
    //
    // 앤티를 낸 직후의 보유 칩을 기준으로, 이번 판 개인별 최대 베팅 상한
    // (판당 최대 베팅 금액)을 여기서 한 번만 확정한다. 플레이어마다 보유
    // 칩이 다르면 상한도 서로 달라지고, 이 차이가 나중에 올인이 발생했을 때
    // 메인 팟/사이드 팟이 나뉘는 원인이 된다.
    const ante = ANTE;

    for (const player of this.state.players) {
      if (player.isSpectator) continue;

      const paid = Math.min(ante, player.chips);

      player.chips -= paid;
      player.anteHandPaid = paid;
      player.maxBet = Math.min(ante * 10, player.chips);

      this.state.pot += paid;
    }

    this.state.phase = "dealing";

    this.dealInitialCards();

    this.state.phase = "betting1";

    const winnerIndex = previousWinnerId
      ? this.state.players.findIndex((player) => player.id === previousWinnerId)
      : -1;

    let startIndex = winnerIndex >= 0 ? winnerIndex : 0;

    // 선(先)이 관전자로 전환됐을 수 있으므로, 실제로 참여 중인 다음 플레이어를 찾는다.
    for (let i = 0; i < this.state.players.length; i++) {
      if (this.state.players[startIndex].status === "playing") break;

      startIndex = (startIndex + 1) % this.state.players.length;
    }

    this.state.currentPlayerIndex = startIndex;

    this.skipCurrentPlayerIfBroke();
  }

  private dealInitialCards(): void {
    for (const player of this.state.players) {
      // 관전자는 카드를 받지 않는다.
      if (player.isSpectator) {
        player.cards = null;
        continue;
      }

      const cards = this.state.deck.draw(2);

      player.cards = [cards[0], cards[1]];
    }
  }

  private dealThirdCard(): void {
    for (const player of this.state.players) {
      // 다이한 플레이어는 더 이상 승부에 참여하지 않으므로 카드를 받지
      // 않는다 — 안 그러면 덱만 불필요하게 소모된다.
      if (!player.cards || player.status !== "playing") {
        continue;
      }

      const [card] = this.state.deck.draw(1);

      player.cards = [...player.cards, card];
    }
  }

  getCurrentPlayer(): Player {
    const player = this.state.players[this.state.currentPlayerIndex];

    if (!player) {
      throw new Error("현재 플레이어를 찾을 수 없습니다.");
    }

    return player;
  }

  private findPlayer(playerId: string): Player {
    const player = this.state.players.find((player) => player.id === playerId);

    if (!player) {
      throw new Error("플레이어를 찾을 수 없습니다.");
    }

    return player;
  }

  private isBettingPhase(): boolean {
    return this.state.phase === "betting1" || this.state.phase === "betting2";
  }

  /**
   * 첫 베팅
   *
   * 현재 베팅 금액이 0일 때만 사용할 수 있습니다. isHalf가 true면 "하프"
   * 액션이다 — 목표 금액(현재 판돈의 1/2, 6장)을 서버가 직접 계산하며,
   * 클라이언트가 함께 보낸 amount는 무시한다. 클라이언트를 신뢰해 그
   * 금액을 그대로 쓰면, 실제로는 판돈의 절반이 아닌 값을 "하프"라고 속여
   * 보내도 서버가 구분할 방법이 없어진다.
   */
  bet(playerId: string, amount: number, isHalf = false): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    if (this.state.currentBet !== 0) {
      throw new Error(
        "이미 베팅이 시작되었습니다. 콜 또는 레이즈를 사용하세요.",
      );
    }

    if (isHalf) {
      amount = Math.max(1, Math.floor(this.state.pot / 2));
    }

    if (amount <= 0) {
      throw new Error("베팅 금액은 0보다 커야 합니다.");
    }

    if (amount > player.chips) {
      throw new Error("칩이 부족합니다.");
    }

    if (amount > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다.");
    }

    player.chips -= amount;
    player.bet += amount;
    player.totalBet += amount;
    player.lastAction = `${isHalf ? "하프" : "베팅"} ${amount.toLocaleString()}`;

    this.state.pot += amount;
    this.state.currentBet = player.bet;
    // 이 라운드를 여는 베팅 금액이 이후 레이즈의 최소 증가폭 기준이 된다.
    this.lastRaiseIncrement = amount;

    this.actedPlayers.add(player.id);

    this.nextTurn();
  }

  /**
   * 체크
   *
   * 현재까지 베팅된 금액과 자신의 베팅 금액이 같아야 합니다.
   */
  check(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    if (player.id !== this.getCurrentPlayer().id) {
      throw new Error("현재 플레이어의 차례가 아닙니다.");
    }

    if (player.status !== "playing") {
      throw new Error("체크할 수 없는 플레이어입니다.");
    }

    if (this.state.currentBet !== 0) {
      throw new Error("현재 베팅이 진행 중이므로 체크할 수 없습니다.");
    }

    player.lastAction = "체크";

    this.actedPlayers.add(player.id);

    this.nextTurn();
  }

  /**
   * 콜
   *
   * 현재 베팅 금액까지 맞춥니다.
   */
  call(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    if (this.state.currentBet <= 0) {
      throw new Error("현재 베팅이 없습니다. 체크 또는 베팅을 사용하세요.");
    }

    const requiredAmount = this.state.currentBet - player.bet;

    if (requiredAmount <= 0) {
      throw new Error("이미 현재 베팅 금액과 동일합니다. 체크를 사용하세요.");
    }

    if (requiredAmount > player.chips) {
      throw new Error(
        "칩이 부족해 콜할 수 없습니다. 올인을 사용하세요.",
      );
    }

    if (requiredAmount > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다.");
    }

    player.chips -= requiredAmount;
    player.bet += requiredAmount;
    player.totalBet += requiredAmount;
    player.lastAction = "콜";

    this.state.pot += requiredAmount;

    this.actedPlayers.add(player.id);

    this.nextTurn();
  }

  /**
   * 레이즈
   *
   * amount는 최종적으로 플레이어가 해당 라운드에 걸고 있는 총액입니다.
   *
   * 예:
   * 현재 베팅 100
   * 내 베팅 100
   * raise(200)
   *
   * -> 추가로 100칩 지불
   * -> 내 베팅 200
   * -> 현재 베팅 200
   */
  /**
   * isHalf가 true면 "하프 레이즈" 액션이다 — 목표 금액(현재 베팅 금액 +
   * 판돈의 1/2)을 서버가 직접 계산하며, 클라이언트가 함께 보낸 amount는
   * 무시한다(bet()의 isHalf와 같은 이유).
   */
  raise(playerId: string, amount: number, isHalf = false): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    if (this.state.currentBet <= 0) {
      throw new Error("아직 베팅이 없습니다. 처음에는 베팅을 사용하세요.");
    }

    if (isHalf) {
      amount =
        this.state.currentBet + Math.max(1, Math.floor(this.state.pot / 2));
    }

    if (amount <= this.state.currentBet) {
      throw new Error(
        `레이즈 금액은 현재 베팅 금액(${this.state.currentBet})보다 커야 합니다.`,
      );
    }

    const raiseSize = amount - this.state.currentBet;

    if (raiseSize < this.lastRaiseIncrement) {
      throw new Error(
        `최소 레이즈 금액은 ${(this.state.currentBet + this.lastRaiseIncrement).toLocaleString()} 이상이어야 합니다.`,
      );
    }

    const additionalAmount = amount - player.bet;

    if (additionalAmount <= 0) {
      throw new Error("레이즈할 금액이 없습니다.");
    }

    if (additionalAmount > player.chips) {
      throw new Error("칩이 부족합니다.");
    }

    if (additionalAmount > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다.");
    }

    player.chips -= additionalAmount;
    player.bet = amount;
    player.totalBet += additionalAmount;

    this.state.pot += additionalAmount;
    this.state.currentBet = amount;
    this.lastRaiseIncrement = raiseSize;

    // 레이즈가 발생했으므로 이전 행동 기록을 초기화
    this.actedPlayers.clear();
    this.actedPlayers.add(player.id);

    // 레이즈로 인해 다른 플레이어들은 다시 행동해야 하므로 표시된 행동도 지운다
    for (const p of this.state.players) {
      p.lastAction = null;
    }

    player.lastAction = `${isHalf ? "하프 레이즈" : "레이즈"} ${amount.toLocaleString()}`;

    this.nextTurn();
  }

  /**
   * 올인
   *
   * 남은 칩과 이번 판 개인별 최대 베팅 상한(maxBet) 중 더 작은 만큼을
   * 전부 베팅한다. 콜(call)과 달리, 그 금액이 currentBet에 못 미치더라도
   * (=완전히 콜하기엔 부족한 올인) 거부하지 않고 있는 만큼만 베팅해
   * 사이드 팟을 형성시킨다 — 보유 칩이 적은 플레이어가 큰 판에서도 정상적으로
   * 승부에 참여할 수 있게 하는 유일한 방법이다.
   *
   * 그 결과 currentBet을 넘어서면 레이즈로 취급해 다른 플레이어가 다시
   * 행동해야 하지만, 넘지 못하면(콜에도 못 미치는 부족한 올인) 조용히
   * 맞출 수 있는 만큼만 맞추고 currentBet과 다른 사람들의 행동 여부는
   * 그대로 둔다.
   */
  allIn(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    const amount = Math.min(player.chips, player.maxBet - player.totalBet);

    if (amount <= 0) {
      throw new Error("더 이상 베팅할 수 없습니다.");
    }

    player.chips -= amount;
    player.bet += amount;
    player.totalBet += amount;

    this.state.pot += amount;

    const label =
      player.chips === 0
        ? `올인 ${amount.toLocaleString()}`
        : `상한 도달 ${amount.toLocaleString()}`;

    if (player.bet > this.state.currentBet) {
      const raiseSize = player.bet - this.state.currentBet;

      this.state.currentBet = player.bet;

      // 콜을 넘어서는(=레이즈에 해당하는) 올인이므로 다른 사람들은 다시
      // 행동해야 한다. 다만 최소 레이즈 증가폭에 못 미치는 "불완전한" 올인
      // 레이즈라면 — 예: 남은 칩이 얼마 없어 어쩔 수 없이 조금만 더 얹은
      // 경우 — 최소 레이즈 기준 자체는 갱신하지 않는다(9장의 예외).
      if (raiseSize >= this.lastRaiseIncrement) {
        this.lastRaiseIncrement = raiseSize;
      }

      this.actedPlayers.clear();

      for (const p of this.state.players) {
        p.lastAction = null;
      }
    }

    player.lastAction = label;

    this.actedPlayers.add(player.id);

    this.nextTurn();
  }

  /**
   * 다이
   */
  fold(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    player.status = "folded";
    player.lastAction = "다이";

    this.actedPlayers.add(player.id);

    this.nextTurn();
  }

  /**
   * 방 나가기
   *
   * 진행 중인 판 도중이라면 다이한 것으로 처리해 판돈(이미 낸 베팅액)은
   * 그대로 잃게 하고, 남은 인원만으로 판이 이어지게 한다. 판이 끝난
   * 뒤(다음 판 시작 전)라면 판 결과에는 영향이 없으므로 바로 제외한다.
   * 어느 쪽이든 이후 판부터는 완전히 빠지며(관전자로도 남지 않음),
   * 화면에도 더 이상 표시되지 않는다.
   */
  leaveGame(playerId: string): void {
    const player = this.findPlayer(playerId);

    const midHandPhase =
      this.state.phase === "betting1" ||
      this.state.phase === "betting2" ||
      this.state.phase === "reveal" ||
      this.state.phase === "select";

    if (midHandPhase && player.status === "playing") {
      const wasCurrentTurn =
        this.isBettingPhase() && this.getCurrentPlayer().id === playerId;

      player.status = "folded";
      player.lastAction = "다이";
      this.actedPlayers.add(player.id);

      const remaining = this.state.players.filter(
        (p) => p.status === "playing",
      );

      if (remaining.length <= 1) {
        this.finishByFold();
      } else if (this.isBettingPhase()) {
        if (wasCurrentTurn) {
          this.nextTurn();
        }
      } else if (this.state.phase === "reveal") {
        if (remaining.every((p) => p.revealedCardIndex !== null)) {
          this.startSecondBettingRound();
        }
      } else if (this.state.phase === "select") {
        if (remaining.every((p) => p.selectedIndices !== null)) {
          this.showdown();
        }
      }
    }

    player.isSpectator = true;
    player.hasLeft = true;
  }

  /**
   * 카드 공개
   *
   * 3번째 카드까지 받은 뒤, 자신의 카드 중 한 장을 상대에게 공개합니다.
   */
  revealCard(playerId: string, cardIndex: number): void {
    if (this.state.phase !== "reveal") {
      throw new Error("지금은 카드를 공개할 수 있는 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    if (player.status !== "playing") {
      throw new Error("카드를 공개할 수 없는 플레이어입니다.");
    }

    if (!player.cards || cardIndex < 0 || cardIndex >= player.cards.length) {
      throw new Error("올바르지 않은 카드입니다.");
    }

    if (player.revealedCardIndex !== null) {
      throw new Error("이미 카드를 공개했습니다.");
    }

    player.revealedCardIndex = cardIndex;

    const activePlayers = this.state.players.filter(
      (player) => player.status === "playing",
    );

    const allRevealed = activePlayers.every(
      (player) => player.revealedCardIndex !== null,
    );

    if (allRevealed) {
      this.startSecondBettingRound();
    }
  }

  /**
   * 족보 선택
   *
   * 3장 중 최종 족보로 쓸 2장을 스스로 고릅니다.
   */
  selectHand(playerId: string, indices: [number, number]): void {
    if (this.state.phase !== "select") {
      throw new Error("지금은 족보를 고를 수 있는 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    if (player.status !== "playing") {
      throw new Error("족보를 고를 수 없는 플레이어입니다.");
    }

    if (!player.cards) {
      throw new Error("카드가 없습니다.");
    }

    const [i, j] = indices;
    const cardCount = player.cards.length;

    if (i === j || i < 0 || i >= cardCount || j < 0 || j >= cardCount) {
      throw new Error("올바르지 않은 카드 선택입니다.");
    }

    if (player.selectedIndices !== null) {
      throw new Error("이미 족보를 골랐습니다.");
    }

    player.selectedIndices = [i, j];

    const activePlayers = this.state.players.filter(
      (player) => player.status === "playing",
    );

    const allSelected = activePlayers.every(
      (player) => player.selectedIndices !== null,
    );

    if (allSelected) {
      this.showdown();
    }
  }

  private startSecondBettingRound(): void {
    this.state.currentBet = 0;

    this.actedPlayers.clear();
    this.lastRaiseIncrement = 0;

    for (const player of this.state.players) {
      player.bet = 0;
      player.lastAction = null;
    }

    this.state.phase = "betting2";

    let nextIndex = 0;

    while (this.state.players[nextIndex].status !== "playing") {
      nextIndex = (nextIndex + 1) % this.state.players.length;
    }

    this.state.currentPlayerIndex = nextIndex;

    this.skipCurrentPlayerIfBroke();
  }

  /**
   * 현재 플레이어인지 검사
   */
  private checkTurn(player: Player): void {
    const currentPlayer = this.getCurrentPlayer();

    if (player.id !== currentPlayer.id) {
      throw new Error("현재 플레이어의 차례가 아닙니다.");
    }

    if (player.status !== "playing") {
      throw new Error("베팅할 수 없는 플레이어입니다.");
    }
  }

  /**
   * 다음 플레이어로 이동하고
   * 베팅 라운드가 끝났는지 검사합니다.
   */
  private nextTurn(): void {
    const activePlayers = this.state.players.filter(
      (player) => player.status === "playing",
    );

    // 다이를 해서 한 명만 남은 경우
    if (activePlayers.length <= 1) {
      this.finishByFold();
      return;
    }

    /*
     * 모든 살아있는 플레이어가
     *
     * 1. 현재 베팅 금액을 맞췄고
     * 2. 이번 라운드에서 행동을 완료했다면
     *
     * 다음 단계로 넘어간다 (첫 베팅 -> 카드 공개, 두 번째 베팅 -> 족보 선택)
     */
    // 파산한(칩이 0인) 플레이어는 더 이상 베팅을 맞출 수 없으므로
    // 맞췄는지 여부와 무관하게 라운드 종료 조건을 통과한 것으로 본다.
    const allMatched = activePlayers.every(
      (player) => player.bet === this.state.currentBet || player.chips === 0,
    );

    const allActed = activePlayers.every((player) =>
      this.actedPlayers.has(player.id),
    );

    if (allMatched && allActed) {
      if (this.state.phase === "betting1") {
        this.dealThirdCard();

        this.state.phase = "reveal";
      } else if (this.state.phase === "betting2") {
        this.state.phase = "select";
      }

      return;
    }

    // 다음 살아있는 플레이어 찾기
    let nextIndex = this.state.currentPlayerIndex;

    do {
      nextIndex = (nextIndex + 1) % this.state.players.length;
    } while (this.state.players[nextIndex].status !== "playing");

    this.state.currentPlayerIndex = nextIndex;

    this.skipCurrentPlayerIfBroke();
  }

  /**
   * 현재 차례인 플레이어가 이미 파산(칩 0)해서 더 이상 베팅할 수 없는
   * 상태라면 자동 패스로 처리하고 다음 플레이어에게 차례를 넘긴다.
   *
   * nextTurn()이 다음 플레이어를 찾은 직후뿐 아니라, 새 베팅 라운드가
   * 막 시작되거나(startSecondBettingRound) 판이 갓 시작됐을 때(start())도
   * 호출한다 — 그 라운드의 첫 차례부터 이미 파산 상태인 플레이어일 수
   * 있기 때문이다(예: 개인별 상한이 매우 낮아 앤티만으로 칩을 다 쓴 경우,
   * 또는 지난 라운드에 올인해 이번 라운드에선 아예 행동할 게 없는 경우).
   */
  private skipCurrentPlayerIfBroke(): void {
    if (!this.isBettingPhase()) return;

    const player = this.state.players[this.state.currentPlayerIndex];

    if (!player || player.status !== "playing") return;

    if (player.chips === 0 && !this.actedPlayers.has(player.id)) {
      player.lastAction = "올인 (자동 패스)";
      this.actedPlayers.add(player.id);
      this.nextTurn();
    }
  }

  /**
   * 쇼다운
   */
  showdown(): void {
    if (this.state.phase !== "select") {
      throw new Error("현재 쇼다운을 진행할 수 없습니다.");
    }

    const activePlayers = this.state.players.filter(
      (player) =>
        player.status === "playing" &&
        player.cards?.length === 3 &&
        player.selectedIndices !== null,
    );

    if (activePlayers.length < 2) {
      this.finishByFold();
      return;
    }

    // 승부가 어떻게 나든(승자 확정이든 재경기든) 일단 패부터 공개한다.
    this.state.phase = "showdown";

    this.resolveShowdownOutcome(activePlayers);
  }

  /**
   * 활성 플레이어들의 패를 비교해 승자 또는 재경기 사유를 판정한다.
   * 칩 지급 등 부수효과는 없는 순수 판정만 담당한다.
   */
  private resolveActivePlayersShowdown(
    activePlayers: Player[],
  ):
    | { type: "winner"; results: Map<string, HandResult> }
    | { type: "redeal"; reason: string } {
    const selectedPairs = new Map(
      activePlayers.map((player) => {
        const cards = player.cards as SeotdaCard[];
        const [i, j] = player.selectedIndices as [number, number];

        return [player.id, [cards[i], cards[j]] as [SeotdaCard, SeotdaCard]];
      }),
    );

    const results = new Map(
      activePlayers.map((player) => [
        player.id,
        evaluateHand(selectedPairs.get(player.id)!),
      ]),
    );

    // 구사 / 멍텅구리 구사는 무조건 재경기가 아니라, 다른 참가자 중 아무도
    // 기준패(구사=알리, 멍텅구리 구사=9땡)를 넘는 패가 없을 때만 판을 무효로
    // 하고 재경기한다. 누군가 기준을 넘는 패를 들고 있으면 재경기 없이
    // 구사류는 망통과 같은 순위로 그냥 진다.
    for (const player of activePlayers) {
      const special = results.get(player.id)!.special;

      if (special !== "gusa" && special !== "meongtunguri-gusa") continue;

      const threshold =
        special === "gusa" ? HAND_RANK.ALI : HAND_RANK.NINE_DDAENG;

      const someoneExceedsThreshold = activePlayers.some(
        (other) =>
          other.id !== player.id &&
          results.get(other.id)!.rank > threshold,
      );

      if (!someoneExceedsThreshold) {
        return {
          type: "redeal",
          reason: special === "meongtunguri-gusa" ? "멍텅구리 구사" : "구사",
        };
      }
    }

    // 재경기 조건이 아니라면, 실제 승자 결정은 finishShowdownWithResults()가
    // 팟(메인 팟/사이드 팟)마다 그 팟의 참가자 범위로 따로 수행한다 — 참가자가
    // 다르면 팟마다 승자가 달라질 수 있기 때문에 여기서는 전체 1등을
    // 미리 정하지 않는다.
    return { type: "winner", results };
  }

  /**
   * 판정 결과를 적용한다. 승자면 바로 확정하고, 재경기면 패를 공개한 채
   * (phase는 "showdown"에 머무름) pendingRedeal에 담아두고 대기시킨다 —
   * 실제 재경기 처리는 서버가 화면에 패를 보여준 뒤 confirmPendingRedeal()을
   * 불러 진행한다.
   */
  private resolveShowdownOutcome(activePlayers: Player[]): void {
    const outcome = this.resolveActivePlayersShowdown(activePlayers);

    if (outcome.type === "winner") {
      this.finishShowdownWithResults(outcome.results, activePlayers);
      return;
    }

    // 재경기는 앤티나 베팅을 새로 만들지 않는 즉시 승부다(34장) — 다이한
    // 사람은 그대로 제외하고, 남은 참가자에게만 새 카드 2장을 배분해
    // 곧바로 다시 비교한다. 기존 판돈은 그대로 유지된다.
    this.state.redealReason = outcome.reason;

    this.pendingRedeal = {
      reason: outcome.reason,
      activePlayerIds: activePlayers.map((player) => player.id),
    };
  }

  /**
   * 팟(메인 팟 + 사이드 팟)마다 그 팟에 낼 자격이 있는(=올인 등으로 빠지지
   * 않고 다이도 하지 않은) 참가자 범위 안에서 따로 승자를 정해 지급한다.
   * 한 팟이라도 받은 플레이어는 "winner"로 표시한다.
   */
  private finishShowdownWithResults(
    results: Map<string, HandResult>,
    activePlayers: Player[],
  ): void {
    const pots = this.buildPots();

    const potWinnerIds: string[] = [];

    for (const pot of pots) {
      if (pot.eligiblePlayerIds.length === 0) continue;

      // 땡잡이·암행어사처럼 특정 패를 잡는 효과가 이 팟 참가자 범위 안에서
      // 발동하는지 먼저 확인한다(17.1) — 발동하면 그 소지자가 팟 전체를
      // 가져가며, 발동하지 않은 다른 참가자의 일반 족보 등급은 비교하지
      // 않는다. 아무도 발동하지 않을 때만 일반 순위(rank/value)로 비교한다.
      const potWinnerId =
        findPrioritySpecialWinner(pot.eligiblePlayerIds, results) ??
        pot.eligiblePlayerIds.reduce((best, candidateId) =>
          compareHandResults(results.get(candidateId)!, results.get(best)!) ===
          1
            ? candidateId
            : best,
        );

      const potWinner = this.findPlayer(potWinnerId);

      potWinner.chips += pot.amount;
      potWinnerIds.push(potWinnerId);

      this.collectDdaengFeeForPot(potWinner, results.get(potWinnerId)!, pot);
    }

    const winnerIds = new Set(potWinnerIds);

    for (const player of activePlayers) {
      player.status = winnerIds.has(player.id) ? "winner" : "loser";
    }

    this.state.pots = pots;
    // 다음 판 선(先) 순서는 항상 메인 팟(가장 먼저 형성되는, 가장 많은
    // 인원이 걸린 팟)의 승자를 기준으로 한다 — pots는 오름차순 레이어로
    // 쌓이므로 pots[0]이 곧 메인 팟이다.
    this.state.winnerId = potWinnerIds[0] ?? null;
    this.state.redealReason = null;
    this.state.phase = "finished";
  }

  /**
   * 이번 판에 각 플레이어가 낸 총액(앤티 + 베팅)을 기준으로 메인 팟과
   * 사이드 팟을 나눈다. 보유 칩이 달라 올인 시점이 서로 다르면 여러 팟으로
   * 갈라지고, 다이한 플레이어의 몫도(이미 낸 돈이므로) 금액에는 포함하되
   * eligiblePlayerIds에서는 제외한다.
   *
   * 예: A=1,000 / B=600 / C=300 세 명 모두 올인
   *   → 메인 팟 300×3=900(전원 참가), 사이드 팟 600-300=300×2=600(A,B만),
   *     A의 초과분 1,000-600=400은 경쟁 상대가 없어 A 혼자만의 팟이 되어
   *     자동으로 A에게 돌아간다.
   */
  private buildPots(): Pot[] {
    const contributors = this.state.players
      .map((player) => ({
        player,
        contribution: player.anteHandPaid + player.totalBet,
      }))
      .filter((entry) => entry.contribution > 0);

    const levels = Array.from(
      new Set(contributors.map((entry) => entry.contribution)),
    ).sort((a, b) => a - b);

    const pots: Pot[] = [];
    let previousLevel = 0;

    for (const level of levels) {
      const layer = contributors.filter(
        (entry) => entry.contribution >= level,
      );
      const amount = (level - previousLevel) * layer.length;

      if (amount > 0) {
        pots.push({
          amount,
          eligiblePlayerIds: layer
            .filter((entry) => entry.player.status !== "folded")
            .map((entry) => entry.player.id),
        });
      }

      previousLevel = level;
    }

    return pots;
  }

  /**
   * 재경기 대기 중인지 여부 — true면 서버가 잠시 뒤 confirmPendingRedeal()을
   * 불러야 한다.
   */
  hasPendingRedeal(): boolean {
    return this.pendingRedeal !== null;
  }

  /**
   * 패를 충분히 보여준 뒤 실제 재경기를 진행한다.
   *
   * 다이한 사람을 뺀 나머지 참가자끼리 베팅·앤티 없이 카드 2장만 새로 받아
   * 곧바로 다시 비교한다(34장 — 기존 판돈은 그대로 유지). 그 결과가 또
   * 재경기 조건이면 pendingRedeal을 다시 채워 같은 과정을 반복한다.
   */
  confirmPendingRedeal(): void {
    if (!this.pendingRedeal) return;

    const { activePlayerIds } = this.pendingRedeal;

    this.pendingRedeal = null;

    const participants = activePlayerIds.map((id) => this.findPlayer(id));

    this.state.deck.reset();

    for (const player of participants) {
      player.cards = this.state.deck.draw(2);
      player.selectedIndices = [0, 1];
      player.revealedCardIndex = null;
      player.bet = 0;
      player.lastAction = null;
    }

    this.state.phase = "showdown";

    this.resolveShowdownOutcome(participants);
  }

  /**
   * 땡값
   *
   * 광땡(13/18/38광땡) 또는 장땡으로 그 팟을 이겼다면, 같은 팟에 낼 자격이
   * 있던(=다이하지 않은) 상대 각자에게서 그 팟 금액의 일정 비율을 추가로
   * 받는다. 메인 팟과 사이드 팟을 모두 이겼다면 각 팟마다 그 팟의 금액을
   * 기준으로 독립적으로 계산한다 — 자신이 참여하지 않은(예: 자신보다 큰)
   * 팟의 참가자에게는 징수하지 않는다.
   */
  private collectDdaengFeeForPot(
    winner: Player,
    winnerResult: HandResult,
    pot: Pot,
  ): void {
    const isGwangddaeng =
      winnerResult.name === "13광땡" ||
      winnerResult.name === "18광땡" ||
      winnerResult.name === "38광땡";
    const isJangddaeng = winnerResult.name === "장땡";

    if (!isGwangddaeng && !isJangddaeng) return;

    const rate = isGwangddaeng ? GWANGDDAENG_FEE_RATE : JANGDDAENG_FEE_RATE;
    const fee = Math.floor(pot.amount * rate);

    if (fee <= 0) return;

    for (const opponentId of pot.eligiblePlayerIds) {
      if (opponentId === winner.id) continue;

      const opponent = this.findPlayer(opponentId);
      const paid = Math.min(fee, opponent.chips);

      opponent.chips -= paid;
      winner.chips += paid;
    }
  }

  /**
   * 패 확인
   *
   * 2장뿐일 때는 그 2장으로, 3장을 받은 뒤에는 스스로 고른 2장으로 판정합니다.
   * 아직 고르지 않았다면 null을 반환합니다.
   */
  getHandResult(playerId: string): HandResult | null {
    const player = this.findPlayer(playerId);

    if (!player.cards || player.cards.length < 2) {
      return null;
    }

    if (player.cards.length === 2) {
      return evaluateHand([player.cards[0], player.cards[1]]);
    }

    if (!player.selectedIndices) {
      return null;
    }

    const [i, j] = player.selectedIndices;

    return evaluateHand([player.cards[i], player.cards[j]]);
  }

  /**
   * 파산한 플레이어를 관전자로 전환합니다.
   *
   * 관전자는 이후 판부터 카드를 받지 않고 앤티도 내지 않으며, 자연히
   * 베팅 차례도 돌아오지 않습니다. 한 판이 끝난 뒤(다시하기 전)에만
   * 전환할 수 있습니다.
   */
  setSpectator(playerId: string): void {
    if (this.state.phase !== "finished") {
      throw new Error("지금은 관전 여부를 바꿀 수 없습니다.");
    }

    this.findPlayer(playerId).isSpectator = true;
  }

  /**
   * 다이로 게임 종료
   */
  private finishByFold(): void {
    const winner = this.state.players.find(
      (player) => player.status === "playing",
    );

    if (!winner) {
      return;
    }

    // 다이로 이겨서 족보를 직접 고르지 못했다면, 공개용으로 가장 높은
    // 조합을 자동으로 확정해준다 (판정에는 영향 없음 — 상대가 없으므로).
    if (winner.cards?.length === 3 && winner.selectedIndices === null) {
      winner.selectedIndices = this.bestPairIndices(winner.cards);
    }

    winner.status = "winner";

    this.awardPot(winner);

    for (const player of this.state.players) {
      if (player.id !== winner.id) {
        if (player.status !== "folded") {
          player.status = "loser";
        }
      }
    }

    this.state.winnerId = winner.id;
    this.state.phase = "finished";
  }

  /**
   * 3장 중 가장 높은 족보가 되는 2장의 인덱스를 반환합니다.
   */
  private bestPairIndices(cards: SeotdaCard[]): [number, number] {
    const pairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];

    let best = pairs[0];
    let bestResult = evaluateHand([cards[best[0]], cards[best[1]]]);

    for (let i = 1; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      const result = evaluateHand([cards[a], cards[b]]);

      if (result.rank > bestResult.rank) {
        best = pairs[i];
        bestResult = result;
      }
    }

    return best;
  }

  /**
   * 승자에게 판돈을 지급합니다.
   *
   * 파산 상태(칩 0)로 승리했더라도 그 이유만으로 보상을 줄이지 않는다 —
   * 자신이 참여한 판에서 정당하게 이긴 몫은 항상 전액 지급한다.
   */
  private awardPot(winner: Player): void {
    winner.chips += this.state.pot;
  }
}
