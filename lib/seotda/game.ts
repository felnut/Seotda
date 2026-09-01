import { ANTE, STARTING_CHIPS } from "./constants";
import { BettingRound, RaiseRatio } from "./bettingRound";
import { Deck } from "./deck";
import { buildPots, collectDdaengFee, distributePot } from "./potManager";
import { evaluateHand, HandResult } from "./ranking";
import { RematchResolver } from "./rematchResolver";
import { GamePhase, GameState, Player } from "./types";
import { SeotdaCard } from "@/types/seotda";

export { ANTE, STARTING_CHIPS } from "./constants";
export type { GamePhase, GameState, Player, PlayerStatus } from "./types";

/**
 * 한 판(딜)의 진행을 오케스트레이션한다. 각 부분의 실제 로직은 전담
 * 모듈에 위임한다.
 *
 *   - BettingRound   — 베팅 라운드 하나의 순서·상한·하프/쿼터/더블·올인
 *   - RematchResolver — 구사류 재경기 판정과 즉시 재대결
 *   - potManager      — 메인 팟/사이드 팟 계산과 땡값
 *
 * 이 클래스 자신은 카드 배분, 단계(phase) 전이, 승자 확정·정산처럼 여러
 * 모듈에 걸친 흐름만 조율한다.
 */
export class SeotdaGame {
  private phase: GamePhase = "waiting";
  private players: Player[];
  private pot = 0;
  private deck = new Deck();
  private winnerId: string | null = null;
  private redealReason: string | null = null;

  private bettingRound: BettingRound;
  private rematchResolver = new RematchResolver();

  constructor(
    players: { name: string; chips?: number }[] = [
      { name: "플레이어 1" },
      { name: "플레이어 2" },
    ],
  ) {
    this.players = players.map((player, index) => ({
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
    }));

    this.bettingRound = new BettingRound(this.players, {
      getPot: () => this.pot,
      addToPot: (amount) => {
        this.pot += amount;
      },
      onRoundComplete: () => this.handleBettingRoundComplete(),
      onHandCompleteByFold: () => this.finishByFold(),
    });
  }

  getState(): GameState {
    return {
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.bettingRound.currentPlayerIndex,
      pot: this.pot,
      currentBet: this.bettingRound.currentBet,
      deck: this.deck,
      winnerId: this.winnerId,
      redealReason: this.redealReason,
    };
  }

  /**
   * @param resetChips "다시하기"로 새 게임을 시작할 때(true)는 칩을 시작 금액으로
   * 되돌린다. 구사 재경기 등 같은 게임 중 재딜일 때(기본값 false)는 기존 칩을
   * 그대로 유지한다.
   */
  start(resetChips: boolean = false): void {
    if (this.phase !== "waiting" && this.phase !== "finished") {
      throw new Error("이미 시작된 게임입니다.");
    }

    // 이전 판의 승자가 다음 판의 선(첫 베팅 순서)이 된다.
    // 승자가 없었다면(첫 판) 기존처럼 0번부터 시작한다.
    const previousWinnerId = this.winnerId;

    this.deck.reset();
    this.pot = 0;
    this.winnerId = null;
    this.redealReason = null;

    for (const player of this.players) {
      player.cards = null;
      player.revealedCardIndex = null;
      player.selectedIndices = null;
      // 관전자는 파산 후 관전을 선택한 플레이어 — 계속 관전 상태를 유지한다.
      player.status = player.isSpectator ? "folded" : "playing";
      player.totalBet = 0;
      player.maxBet = 0;
      player.anteHandPaid = 0;

      if (resetChips) {
        player.chips = STARTING_CHIPS;
      }
    }

    // 베팅 한도 = 판 시작 시점(앤티를 내기 전) 참가자 전원의 보유 칩
    // 평균값(버림). 판마다 참가자들의 칩 상황에 맞춰 다시 계산되는 값이며,
    // 모든 참가자에게 공통으로 적용되는 상한이다.
    const activePlayers = this.players.filter((player) => !player.isSpectator);
    const totalChipsBeforeAnte = activePlayers.reduce(
      (sum, player) => sum + player.chips,
      0,
    );
    const sharedBetLimit =
      activePlayers.length > 0
        ? Math.floor(totalChipsBeforeAnte / activePlayers.length)
        : 0;

    // 시작금(앤티) 자동 징수 — 칩이 부족하면 있는 만큼만 낸다(파산 처리는
    // 베팅 단계에서 자동으로 진행된다). 관전자는 앤티를 내지 않는다.
    //
    // 앤티를 낸 직후의 보유 칩과 위에서 구한 공통 베팅 한도 중 더 작은
    // 값을, 이번 판 개인별 최대 베팅 상한(판당 최대 베팅 금액)으로 여기서
    // 한 번만 확정한다. 올인은 이 상한의 예외다(bettingRound.allIn 참고).
    for (const player of this.players) {
      if (player.isSpectator) continue;

      const paid = Math.min(ANTE, player.chips);

      player.chips -= paid;
      player.anteHandPaid = paid;
      player.maxBet = Math.min(sharedBetLimit, player.chips);

      this.pot += paid;
    }

    this.phase = "dealing";

    this.dealInitialCards();

    this.phase = "betting1";

    const winnerIndex = previousWinnerId
      ? this.players.findIndex((player) => player.id === previousWinnerId)
      : -1;

    let startIndex = winnerIndex >= 0 ? winnerIndex : 0;

    // 선(先)이 관전자로 전환됐을 수 있으므로, 실제로 참여 중인 다음 플레이어를 찾는다.
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[startIndex].status === "playing") break;

      startIndex = (startIndex + 1) % this.players.length;
    }

    this.bettingRound.start(startIndex);
  }

  private dealInitialCards(): void {
    for (const player of this.players) {
      // 관전자는 카드를 받지 않는다.
      if (player.isSpectator) {
        player.cards = null;
        continue;
      }

      const cards = this.deck.draw(2);

      player.cards = [cards[0], cards[1]];
    }
  }

  private dealThirdCard(): void {
    for (const player of this.players) {
      // 다이한 플레이어는 더 이상 승부에 참여하지 않으므로 카드를 받지
      // 않는다 — 안 그러면 덱만 불필요하게 소모된다.
      if (!player.cards || player.status !== "playing") {
        continue;
      }

      const [card] = this.deck.draw(1);

      player.cards = [...player.cards, card];
    }
  }

  getCurrentPlayer(): Player {
    return this.bettingRound.getCurrentPlayer();
  }

  private findPlayer(playerId: string): Player {
    const player = this.players.find((player) => player.id === playerId);

    if (!player) {
      throw new Error("플레이어를 찾을 수 없습니다.");
    }

    return player;
  }

  private isBettingPhase(): boolean {
    return this.phase === "betting1" || this.phase === "betting2";
  }

  /**
   * 체크 — 현재까지 베팅된 금액과 자신의 베팅 금액이 같아야 합니다.
   */
  check(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    this.bettingRound.check(this.findPlayer(playerId));
  }

  /**
   * 콜 — 현재 베팅 금액까지 맞춥니다.
   */
  call(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    this.bettingRound.call(this.findPlayer(playerId));
  }

  /**
   * 하프/쿼터/더블 — 베팅을 열 때든 레이즈할 때든 같은 액션입니다. 목표
   * 금액(현재 팟 × 배율)은 서버가 계산합니다.
   */
  raiseByRatio(playerId: string, ratio: RaiseRatio): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    this.bettingRound.raiseByRatio(this.findPlayer(playerId), ratio);
  }

  /**
   * 올인 — 남은 칩을 전부 베팅합니다. 판당 최대 베팅 금액의 예외입니다.
   * 자세한 내용은 BettingRound.allIn()을 참고하세요.
   */
  allIn(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    this.bettingRound.allIn(this.findPlayer(playerId));
  }

  /**
   * 다이
   */
  fold(playerId: string): void {
    if (!this.isBettingPhase()) {
      throw new Error("현재 베팅 단계가 아닙니다.");
    }

    this.bettingRound.fold(this.findPlayer(playerId));
  }

  /**
   * 방 나가기
   *
   * 진행 중인 판 도중이라면 다이한 것으로 처리해 판돈(이미 낸 베팅액)은
   * 그대로 잃게 하고, 남은 인원만으로 판이 이어지게 한다. 판이 끝난
   * 뒤(다음 판 시작 전)라면 판 결과에는 영향이 없으므로 바로 제외한다.
   * 어느 쪽이든 이후 판부터는 완전히 빠지며(관전자로도 남지 않음),
   * 화면에도 더 이상 표시되지 않는다.
   *
   * @returns 이번 나가기가 실제로 진행 중이던 판에서 자동 다이(패배)로
   * 이어졌으면 true — 호출부(서버)가 다른 참가자에게 "자동 패배 처리"
   * 안내를 보낼지 판단하는 데 쓴다.
   */
  leaveGame(playerId: string): boolean {
    const player = this.findPlayer(playerId);

    const midHandPhase =
      this.phase === "betting1" ||
      this.phase === "betting2" ||
      this.phase === "reveal" ||
      this.phase === "select";

    const causedAutoLoss = midHandPhase && player.status === "playing";

    if (causedAutoLoss) {
      const wasCurrentTurn =
        this.isBettingPhase() && this.getCurrentPlayer().id === playerId;

      player.status = "folded";
      player.lastAction = "다이";

      const remaining = this.players.filter((p) => p.status === "playing");

      if (remaining.length <= 1) {
        this.finishByFold();
      } else if (this.isBettingPhase()) {
        if (wasCurrentTurn) {
          this.bettingRound.advanceAfterExternalFold(player);
        }
      } else if (this.phase === "reveal") {
        if (remaining.every((p) => p.revealedCardIndex !== null)) {
          this.startSecondBettingRound();
        }
      } else if (this.phase === "select") {
        if (remaining.every((p) => p.selectedIndices !== null)) {
          this.showdown();
        }
      }
    }

    player.isSpectator = true;
    player.hasLeft = true;

    return causedAutoLoss;
  }

  /**
   * 방에 이 사람 한 명만 남았을 때, 진행 중이던 판/직전 판 결과와 무관하게
   * 그 사람을 승자로 확정한다. 이미 이 사람이 승자로 확정돼 있다면(예:
   * leaveGame이 다이 처리로 방금 finishByFold를 실행한 경우) 아무 일도
   * 하지 않는다 — 판돈을 중복으로 지급하지 않기 위함이다.
   */
  declareSoleSurvivorWinner(playerId: string): void {
    if (this.phase === "finished" && this.winnerId === playerId) return;

    const player = this.findPlayer(playerId);

    player.status = "winner";

    for (const other of this.players) {
      if (other.id !== playerId && other.status !== "folded") {
        other.status = "loser";
      }
    }

    this.winnerId = playerId;
    this.phase = "finished";
  }

  /**
   * 카드 공개
   *
   * 3번째 카드까지 받은 뒤, 자신의 카드 중 한 장을 상대에게 공개합니다.
   */
  revealCard(playerId: string, cardIndex: number): void {
    if (this.phase !== "reveal") {
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

    const activePlayers = this.players.filter(
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
    if (this.phase !== "select") {
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

    const activePlayers = this.players.filter(
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
    this.phase = "betting2";

    let nextIndex = 0;

    while (this.players[nextIndex].status !== "playing") {
      nextIndex = (nextIndex + 1) % this.players.length;
    }

    this.bettingRound.start(nextIndex);
  }

  /**
   * BettingRound가 라운드 종료를 알려올 때 호출된다 — 1차 베팅이었다면
   * 3번째 카드를 배분하고 카드 공개 단계로, 2차 베팅이었다면 족보 선택
   * 단계로 넘어간다.
   */
  private handleBettingRoundComplete(): void {
    if (this.phase === "betting1") {
      this.dealThirdCard();

      this.phase = "reveal";
    } else if (this.phase === "betting2") {
      this.phase = "select";
    }
  }

  /**
   * 쇼다운
   */
  showdown(): void {
    if (this.phase !== "select") {
      throw new Error("현재 쇼다운을 진행할 수 없습니다.");
    }

    const activePlayers = this.players.filter(
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
    this.phase = "showdown";

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

    const redealReason = this.rematchResolver.detect(activePlayers, results);

    if (redealReason) {
      return { type: "redeal", reason: redealReason };
    }

    // 재경기 조건이 아니라면, 실제 승자·수령액 결정은
    // finishShowdownWithResults()가 순위별로 수행한다.
    return { type: "winner", results };
  }

  /**
   * 판정 결과를 적용한다. 승자면 바로 확정하고, 재경기면 패를 공개한 채
   * (phase는 "showdown"에 머무름) RematchResolver에 대기시킨다 — 실제
   * 재경기 처리는 서버가 화면에 패를 보여준 뒤 confirmPendingRedeal()을
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
    this.redealReason = outcome.reason;
  }

  /**
   * 팟(메인 팟 + 사이드 팟)마다 그 팟에 낼 자격이 있는(=그 금액까지
   * 내고 다이하지 않은) 참가자 범위 안에서 따로 승자(들)를 정해 지급한다.
   * 한 팟이라도 받은 플레이어는 "winner"로 표시한다.
   */
  private finishShowdownWithResults(
    results: Map<string, HandResult>,
    activePlayers: Player[],
  ): void {
    const pots = buildPots(this.players);

    const potWinnerIds: string[] = [];
    let mainPotWinnerId: string | null = null;

    for (const pot of pots) {
      const payouts = distributePot(pot, results, this.players);

      for (const [playerId, amount] of payouts) {
        if (amount <= 0) continue;

        const winner = this.findPlayer(playerId);

        winner.chips += amount;
        potWinnerIds.push(playerId);
        mainPotWinnerId ??= playerId;

        collectDdaengFee(
          winner,
          results.get(playerId)!,
          amount,
          pot.eligiblePlayerIds,
          this.players,
        );
      }
    }

    const winnerIds = new Set(potWinnerIds);

    for (const player of activePlayers) {
      player.status = winnerIds.has(player.id) ? "winner" : "loser";
    }

    // 다음 판 선(先) 순서는 항상 메인 팟(가장 먼저 형성되는, 가장 많은
    // 인원이 걸린 팟)의 승자를 기준으로 한다 — pots는 오름차순 레이어로
    // 쌓이므로 가장 먼저 지급되는 승자가 곧 메인 팟 승자다.
    this.winnerId = mainPotWinnerId;
    this.redealReason = null;
    this.phase = "finished";
  }

  /**
   * 재경기 대기 중인지 여부 — true면 서버가 잠시 뒤 confirmPendingRedeal()을
   * 불러야 한다.
   */
  hasPendingRedeal(): boolean {
    return this.rematchResolver.hasPending();
  }

  /**
   * 패를 충분히 보여준 뒤 실제 재경기를 진행한다 — 다이한 사람을 뺀 나머지
   * 참가자끼리 카드 2장만 새로 받아 곧바로 다시 비교한다. 그 결과가 또
   * 재경기 조건이면 RematchResolver가 다시 대기 상태를 채워 같은 과정을
   * 반복한다.
   */
  confirmPendingRedeal(): void {
    const participants = this.rematchResolver.confirm(this.deck, (id) =>
      this.findPlayer(id),
    );

    if (participants.length === 0) return;

    this.phase = "showdown";

    this.resolveShowdownOutcome(participants);
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
    if (this.phase !== "finished") {
      throw new Error("지금은 관전 여부를 바꿀 수 없습니다.");
    }

    this.findPlayer(playerId).isSpectator = true;
  }

  /**
   * 다이로 게임 종료
   */
  private finishByFold(): void {
    const winner = this.players.find((player) => player.status === "playing");

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

    for (const player of this.players) {
      if (player.id !== winner.id) {
        if (player.status !== "folded") {
          player.status = "loser";
        }
      }
    }

    this.winnerId = winner.id;
    this.phase = "finished";
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
    winner.chips += this.pot;
  }
}
