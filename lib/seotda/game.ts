import { Deck } from "./deck";
import { compareHands, evaluateHand, HandResult } from "./ranking";
import { SeotdaCard } from "@/types/seotda";

export type PlayerStatus = "playing" | "folded" | "winner" | "loser";

export interface Player {
  id: string;
  name: string;
  cards: SeotdaCard[] | null;
  revealedCardIndex: number | null;
  selectedIndices: [number, number] | null;
  status: PlayerStatus;
  chips: number;
  bet: number;
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
}

export class SeotdaGame {
  private state: GameState;

  // 이번 베팅 라운드에서 행동을 완료한 플레이어
  private actedPlayers = new Set<string>();

  constructor(playerNames: string[] = ["플레이어 1", "플레이어 2"]) {
    this.state = {
      phase: "waiting",

      players: playerNames.map((name, index) => ({
        id: `player-${index + 1}`,
        name,
        cards: null,
        revealedCardIndex: null,
        selectedIndices: null,
        status: "playing",
        chips: 1000,
        bet: 0,
      })),

      currentPlayerIndex: 0,
      pot: 0,
      currentBet: 0,

      deck: new Deck(),

      winnerId: null,
    };
  }

  getState(): GameState {
    return this.state;
  }

  start(): void {
    if (this.state.phase !== "waiting" && this.state.phase !== "finished") {
      throw new Error("이미 시작된 게임입니다.");
    }

    this.state.deck.reset();

    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.winnerId = null;
    this.state.currentPlayerIndex = 0;

    this.actedPlayers.clear();

    for (const player of this.state.players) {
      player.cards = null;
      player.revealedCardIndex = null;
      player.selectedIndices = null;
      player.status = "playing";
      player.bet = 0;
    }

    this.state.phase = "dealing";

    this.dealInitialCards();

    this.state.phase = "betting1";
    this.state.currentPlayerIndex = 0;
  }

  private dealInitialCards(): void {
    for (const player of this.state.players) {
      const cards = this.state.deck.draw(2);

      player.cards = [cards[0], cards[1]];
    }
  }

  private dealThirdCard(): void {
    for (const player of this.state.players) {
      if (!player.cards) {
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
   * 현재 베팅 금액이 0일 때만 사용할 수 있습니다.
   */
  bet(playerId: string, amount: number): void {
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

    if (amount <= 0) {
      throw new Error("베팅 금액은 0보다 커야 합니다.");
    }

    if (amount > player.chips) {
      throw new Error("칩이 부족합니다.");
    }

    player.chips -= amount;
    player.bet += amount;

    this.state.pot += amount;
    this.state.currentBet = player.bet;

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
      throw new Error("칩이 부족합니다.");
    }

    player.chips -= requiredAmount;
    player.bet += requiredAmount;

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
  raise(playerId: string, amount: number): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    const player = this.findPlayer(playerId);

    this.checkTurn(player);

    if (this.state.currentBet <= 0) {
      throw new Error("아직 베팅이 없습니다. 처음에는 베팅을 사용하세요.");
    }

    if (amount <= this.state.currentBet) {
      throw new Error(
        `레이즈 금액은 현재 베팅 금액(${this.state.currentBet})보다 커야 합니다.`,
      );
    }

    const additionalAmount = amount - player.bet;

    if (additionalAmount <= 0) {
      throw new Error("레이즈할 금액이 없습니다.");
    }

    if (additionalAmount > player.chips) {
      throw new Error("칩이 부족합니다.");
    }

    player.chips -= additionalAmount;
    player.bet = amount;

    this.state.pot += additionalAmount;
    this.state.currentBet = amount;

    // 레이즈가 발생했으므로 이전 행동 기록을 초기화
    this.actedPlayers.clear();
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

    this.actedPlayers.add(player.id);

    this.nextTurn();
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

    for (const player of this.state.players) {
      player.bet = 0;
    }

    this.state.phase = "betting2";

    let nextIndex = 0;

    while (this.state.players[nextIndex].status !== "playing") {
      nextIndex = (nextIndex + 1) % this.state.players.length;
    }

    this.state.currentPlayerIndex = nextIndex;
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
    const allMatched = activePlayers.every(
      (player) => player.bet === this.state.currentBet,
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

    this.state.phase = "showdown";

    const selectedPairs = new Map(
      activePlayers.map((player) => {
        const cards = player.cards as SeotdaCard[];
        const [i, j] = player.selectedIndices as [number, number];

        return [player.id, [cards[i], cards[j]] as [SeotdaCard, SeotdaCard]];
      }),
    );

    let winner = activePlayers[0];

    for (let i = 1; i < activePlayers.length; i++) {
      const current = activePlayers[i];

      const result = compareHands(
        selectedPairs.get(current.id)!,
        selectedPairs.get(winner.id)!,
      );

      if (result === 1) {
        winner = current;
      }
    }

    winner.status = "winner";

    for (const player of activePlayers) {
      if (player.id !== winner.id) {
        player.status = "loser";
      }
    }

    winner.chips += this.state.pot;

    this.state.winnerId = winner.id;
    this.state.phase = "finished";
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
   * 다이로 게임 종료
   */
  private finishByFold(): void {
    const winner = this.state.players.find(
      (player) => player.status === "playing",
    );

    if (!winner) {
      return;
    }

    winner.status = "winner";

    winner.chips += this.state.pot;

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
}
