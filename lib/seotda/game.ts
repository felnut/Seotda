import { Deck } from "./deck";
import { compareHands, evaluateHand, HandResult } from "./ranking";
import { SeotdaCard } from "@/types/seotda";

export type PlayerStatus = "playing" | "folded" | "winner" | "loser";

export const STARTING_CHIPS = 10_000;

// 매 판 시작 시 자동으로 내는 시작금(앤티)
export const ANTE = 100;

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
        chips: STARTING_CHIPS,
        bet: 0,
        lastAction: null,
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
      player.status = "playing";
      player.bet = 0;
      player.lastAction = null;

      if (resetChips) {
        player.chips = STARTING_CHIPS;
      }
    }

    // 시작금(앤티) 자동 징수 — 칩이 부족하면 있는 만큼만 낸다(파산 처리는
    // 베팅 단계에서 자동으로 진행된다). 구사 재경기 직후라면 앤티가 배가 된다.
    const ante = ANTE * this.state.nextAnteMultiplier;

    for (const player of this.state.players) {
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

    this.state.currentPlayerIndex = winnerIndex >= 0 ? winnerIndex : 0;
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
    player.lastAction = `베팅 ${amount.toLocaleString()}`;

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

    this.state.phase = "showdown";

    const selectedPairs = new Map(
      activePlayers.map((player) => {
        const cards = player.cards as SeotdaCard[];
        const [i, j] = player.selectedIndices as [number, number];

        return [player.id, [cards[i], cards[j]] as [SeotdaCard, SeotdaCard]];
      }),
    );

    // 구사 / 멍텅구리 구사는 승패를 가리지 않고 판을 무효로 하여 재경기한다.
    for (const player of activePlayers) {
      const special = evaluateHand(selectedPairs.get(player.id)!).special;

      if (special === "gusa" || special === "meongtunguri-gusa") {
        this.voidHandForRedeal(
          special === "meongtunguri-gusa" ? "멍텅구리 구사" : "구사",
        );
        return;
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

    winner.status = "winner";

    for (const player of activePlayers) {
      if (player.id !== winner.id) {
        player.status = "loser";
      }
    }

    this.awardPot(winner);

    this.state.winnerId = winner.id;
    this.state.phase = "finished";
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
    if (
      winner.cards?.length === 3 &&
      winner.selectedIndices === null
    ) {
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
      .filter(
        (player) => player.id !== winner.id && player.status !== "folded",
      )
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
