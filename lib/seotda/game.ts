import { Deck } from "./deck";
import { compareHands, evaluateHand, HAND_RANK, HandResult } from "./ranking";
import { SeotdaCard } from "@/types/seotda";

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
  bet: number;
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
  | "redeal"
  | "finished";

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  pot: number;
  currentBet: number;
  deck: Deck;
  winnerId: string | null;
  // 구사/멍텅구리 구사로 재경기가 될 때 그 사유
  redealReason: string | null;
  // 구사류로 재경기가 거듭될수록 배로 불어나는 다음 판 앤티 배수 (묻고 더블)
  nextAnteMultiplier: number;
}

export class SeotdaGame {
  private state: GameState;

  // 이번 베팅 라운드에서 행동을 완료한 플레이어
  private actedPlayers = new Set<string>();

  // 구사/멍텅구리 구사로 재경기가 결정됐지만, 아직 패를 공개해서 보여주는
  // 중이라 실제 재경기 처리(voidHandForRedeal 또는 즉시 재대결)를 미뤄둔 상태.
  // instant: 이번 판에 다이한 사람이 있으면 true — 그 사람들은 제외하고
  // activePlayerIds만 베팅 없이 새 카드를 받아 즉시 재대결한다.
  private pendingRedeal: {
    reason: string;
    instant: boolean;
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
      nextAnteMultiplier: 1,
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
    if (
      this.state.phase !== "waiting" &&
      this.state.phase !== "finished" &&
      this.state.phase !== "redeal"
    ) {
      throw new Error("이미 시작된 게임입니다.");
    }

    // 이전 판의 승자가 다음 판의 선(첫 베팅 순서)이 된다.
    // 승자가 없었다면(첫 판, 재경기) 기존처럼 0번부터 시작한다.
    const previousWinnerId = this.state.winnerId;

    // 구사류로 인한 재경기라면 판돈은 묻어두고(그대로 두고) 앤티만 배로 걷는다.
    const isRedealContinuation = this.state.phase === "redeal";

    this.state.deck.reset();

    if (!isRedealContinuation) {
      this.state.pot = 0;
    }

    this.state.currentBet = 0;
    this.state.winnerId = null;
    this.state.redealReason = null;

    this.actedPlayers.clear();

    for (const player of this.state.players) {
      player.cards = null;
      player.revealedCardIndex = null;
      player.selectedIndices = null;
      // 관전자는 파산 후 관전을 선택한 플레이어 — 계속 관전 상태를 유지한다.
      player.status = player.isSpectator ? "folded" : "playing";
      player.bet = 0;
      player.lastAction = null;

      if (resetChips) {
        player.chips = STARTING_CHIPS;
      }
    }

    // 시작금(앤티) 자동 징수 — 칩이 부족하면 있는 만큼만 낸다(파산 처리는
    // 베팅 단계에서 자동으로 진행된다). 구사 재경기 직후라면 앤티가 배가 된다.
    // 관전자는 앤티를 내지 않는다.
    const ante = ANTE * this.state.nextAnteMultiplier;

    for (const player of this.state.players) {
      if (player.isSpectator) continue;

      const paid = Math.min(ante, player.chips);

      player.chips -= paid;
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

    if (amount <= 0) {
      throw new Error("베팅 금액은 0보다 커야 합니다.");
    }

    if (amount > player.chips) {
      throw new Error("칩이 부족합니다.");
    }

    player.chips -= amount;
    player.bet += amount;
    player.lastAction = `${isHalf ? "하프" : "베팅"} ${amount.toLocaleString()}`;

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
      throw new Error("칩이 부족합니다.");
    }

    player.chips -= requiredAmount;
    player.bet += requiredAmount;
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

    // 레이즈로 인해 다른 플레이어들은 다시 행동해야 하므로 표시된 행동도 지운다
    for (const p of this.state.players) {
      p.lastAction = null;
    }

    player.lastAction = `레이즈 ${amount.toLocaleString()}`;

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

    // 파산한 플레이어는 베팅에 참여할 수 없으므로 자동으로 차례를 넘긴다.
    const nextPlayer = this.state.players[nextIndex];

    if (nextPlayer.chips === 0 && !this.actedPlayers.has(nextPlayer.id)) {
      nextPlayer.lastAction = "올인 (자동 패스)";
      this.actedPlayers.add(nextPlayer.id);
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
    | { type: "winner"; winner: Player; results: Map<string, HandResult> }
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

    return { type: "winner", winner, results };
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
      this.finishShowdownWithWinner(
        outcome.winner,
        outcome.results,
        activePlayers,
      );
      return;
    }

    // 이번 판에 다이한 사람이 있다면, 그 사람들은 빼고 남은 사람끼리만
    // 베팅 없이 즉시 재대결한다(요청 사항). 없다면 기존처럼 판돈을 묻고
    // 다음 판 앤티를 배로 올리는 정식 재경기.
    const instant = this.state.players.some(
      (player) => player.status === "folded" && !player.isSpectator,
    );

    this.pendingRedeal = {
      reason: outcome.reason,
      instant,
      activePlayerIds: activePlayers.map((player) => player.id),
    };
  }

  private finishShowdownWithWinner(
    winner: Player,
    results: Map<string, HandResult>,
    activePlayers: Player[],
  ): void {
    winner.status = "winner";

    for (const player of activePlayers) {
      if (player.id !== winner.id) {
        player.status = "loser";
      }
    }

    this.awardPot(winner);
    this.collectDdaengFee(winner, results.get(winner.id)!, activePlayers);

    this.state.winnerId = winner.id;
    this.state.phase = "finished";
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
   * 다이한 사람이 없었다면 기존 "묻고 더블" 재경기(voidHandForRedeal)로,
   * 있었다면 그 사람들을 뺀 나머지끼리 베팅·앤티 없이 카드 2장만 새로 받아
   * 곧바로 다시 비교한다(판돈은 그대로 유지). 그 결과가 또 재경기 조건이면
   * pendingRedeal을 다시 채워 같은 과정을 반복한다.
   */
  confirmPendingRedeal(): void {
    if (!this.pendingRedeal) return;

    const { reason, instant, activePlayerIds } = this.pendingRedeal;

    this.pendingRedeal = null;

    if (!instant) {
      this.voidHandForRedeal(reason);
      return;
    }

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
   * 광땡(13/18/38광땡) 또는 장땡으로 이겼다면, 다이하지 않고 마지막까지
   * 대결한 상대 전원에게서 딴 금액(판돈)의 일정 비율을 추가로 받는다.
   * 각자 자신의 남은 칩에서 낸다(부족하면 있는 만큼만).
   */
  private collectDdaengFee(
    winner: Player,
    winnerResult: HandResult,
    activePlayers: Player[],
  ): void {
    const isGwangddaeng =
      winnerResult.name === "13광땡" ||
      winnerResult.name === "18광땡" ||
      winnerResult.name === "38광땡";
    const isJangddaeng = winnerResult.name === "장땡";

    if (!isGwangddaeng && !isJangddaeng) return;

    const rate = isGwangddaeng ? GWANGDDAENG_FEE_RATE : JANGDDAENG_FEE_RATE;
    const fee = Math.floor(this.state.pot * rate);

    if (fee <= 0) return;

    for (const opponent of activePlayers) {
      if (opponent.id === winner.id) continue;

      const paid = Math.min(fee, opponent.chips);

      opponent.chips -= paid;
      winner.chips += paid;
    }
  }

  /**
   * 구사류 특수 족보로 인한 무효 처리 — "묻고 더블"
   *
   * 판돈은 환불하지 않고 그대로 묻어두며(다음 판 판돈에 합산), 다음 판의
   * 앤티가 두 배가 된다. 연속으로 구사가 나면 앤티는 계속 배로 불어난다.
   * 실제 재경기(카드 재분배)는 서버 쪽에서 잠시 뒤 start()를 호출해 진행한다.
   */
  private voidHandForRedeal(reason: string): void {
    this.state.nextAnteMultiplier *= 2;
    this.state.redealReason = reason;
    this.state.phase = "redeal";
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
   * 승자가 파산 상태(칩 0)로 승리했다면, 다른 참가자들이 이번 판에 낸
   * 돈으로 쌓인 판돈을 혼자 다 가져가는 게 불공평하므로 절반만 가져가고
   * 나머지 절반은 다이하지 않고 남아있던 플레이어 중 패의 순위가 두 번째로
   * 높은 사람에게 준다. (다이한 플레이어는 2등 후보에서 제외한다. 다이로
   * 이겨서 남은 플레이어가 아무도 없다면 승자가 전액을 가져간다.)
   */
  private awardPot(winner: Player): void {
    // 실제로 승부가 갈렸으니 다음 판을 위해 앤티 배수를 원래대로 되돌린다.
    this.state.nextAnteMultiplier = 1;

    if (winner.chips > 0) {
      winner.chips += this.state.pot;
      return;
    }

    const halfPot = Math.floor(this.state.pot / 2);
    const remainder = this.state.pot - halfPot;

    const runnerUp = this.state.players
      .filter((player) => player.id !== winner.id && player.status !== "folded")
      .map((player) => ({
        player,
        result: this.getComparableHandResult(player),
      }))
      .filter(
        (entry): entry is { player: Player; result: HandResult } =>
          entry.result !== null,
      )
      .sort((a, b) => {
        if (a.result.rank !== b.result.rank) {
          return b.result.rank - a.result.rank;
        }

        return b.result.value - a.result.value;
      })[0]?.player;

    winner.chips += halfPot;

    if (runnerUp) {
      runnerUp.chips += remainder;
    } else {
      // 비교할 상대가 없다면(예: 1명뿐인 방) 그냥 전액 지급한다.
      winner.chips += remainder;
    }
  }

  /**
   * 다이 여부와 무관하게, 플레이어가 가진 카드 기준 최선의 족보를 계산합니다.
   * (파산 승자의 판돈을 나눌 2등을 가리기 위한 용도)
   */
  private getComparableHandResult(player: Player): HandResult | null {
    if (!player.cards || player.cards.length < 2) {
      return null;
    }

    if (player.cards.length === 2) {
      return evaluateHand([player.cards[0], player.cards[1]]);
    }

    const [i, j] = player.selectedIndices ?? this.bestPairIndices(player.cards);

    return evaluateHand([player.cards[i], player.cards[j]]);
  }
}
