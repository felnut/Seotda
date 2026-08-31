import { Player } from "./types";

// 베팅 라운드 하나(1차 또는 2차)의 진행을 전담한다 — 순서, 상한, 최소 레이즈,
// 파산 플레이어 자동 패스까지 전부 이 클래스 안에서 처리한다. 라운드가
// 끝나야만 알 수 있는 다음 단계(카드 공개로 넘어갈지, 쇼다운으로 넘어갈지)나
// 다이로 인해 판 자체가 끝나는 경우는 이 클래스의 책임이 아니므로, 그 시점에
// deps의 콜백을 통해 오케스트레이터(SeotdaGame)에게 알린다. 판돈(pot)도
// 베팅 라운드를 넘어 쇼다운까지 이어지는 판 전체의 값이라 여기서 직접
// 들고 있지 않고 deps를 통해 읽고 더한다.
export interface BettingRoundDeps {
  getPot(): number;
  addToPot(amount: number): void;
  onRoundComplete(): void;
  onHandCompleteByFold(): void;
}

export class BettingRound {
  currentBet = 0;
  currentPlayerIndex = 0;

  // 이번 라운드에서 행동을 완료한 플레이어
  private actedPlayers = new Set<string>();

  // 이번 라운드에서 마지막으로 인정된 "완전한" 레이즈의 증가폭. 다음
  // 레이즈는 최소한 이만큼은 더 올려야 한다(최소 레이즈 규칙) — 그래야
  // 1칩씩 레이즈를 반복해 상대의 행동을 계속 다시 요구하며 진행을
  // 지연시키는 것을 막을 수 있다. 라운드를 여는 첫 베팅의 금액이 그
  // 라운드의 기준이 되며, 올인이 이 기준에 못 미치는 "불완전한" 레이즈이면
  // 갱신하지 않는다.
  private lastRaiseIncrement = 0;

  constructor(
    private players: Player[],
    private deps: BettingRoundDeps,
  ) {}

  /**
   * 새 베팅 라운드를 시작한다. startIndex(선 순서 등 게임 차원의 규칙으로
   * 정해진 첫 차례)부터 시작하되, 그 플레이어가 이미 파산 상태라면 자동으로
   * 넘긴다. 전원 참여 여부와 무관하게 모든 플레이어의 이번 라운드 베팅액과
   * 표시용 마지막 행동을 초기화한다.
   */
  start(startIndex: number): void {
    this.currentBet = 0;
    this.actedPlayers.clear();
    this.lastRaiseIncrement = 0;
    this.currentPlayerIndex = startIndex;

    for (const player of this.players) {
      player.bet = 0;
      player.lastAction = null;
    }

    this.skipCurrentPlayerIfBroke();
  }

  getCurrentPlayer(): Player {
    const player = this.players[this.currentPlayerIndex];

    if (!player) {
      throw new Error("현재 플레이어를 찾을 수 없습니다.");
    }

    return player;
  }

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
   * 첫 베팅
   *
   * 현재 베팅 금액이 0일 때만 사용할 수 있습니다. isHalf가 true면 "하프"
   * 액션이다 — 목표 금액(현재 판돈의 1/2, 6장)을 직접 계산하며, 호출자가
   * 함께 넘긴 amount는 무시한다. 클라이언트를 신뢰해 그 금액을 그대로 쓰면,
   * 실제로는 판돈의 절반이 아닌 값을 "하프"라고 속여 보내도 구분할 방법이
   * 없어진다.
   */
  bet(player: Player, amount: number, isHalf: boolean): void {
    this.checkTurn(player);

    if (this.currentBet !== 0) {
      throw new Error(
        "이미 베팅이 시작되었습니다. 콜 또는 레이즈를 사용하세요.",
      );
    }

    if (isHalf) {
      amount = Math.max(1, Math.floor(this.deps.getPot() / 2));
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

    this.deps.addToPot(amount);
    this.currentBet = player.bet;
    // 이 라운드를 여는 베팅 금액이 이후 레이즈의 최소 증가폭 기준이 된다.
    this.lastRaiseIncrement = amount;

    this.actedPlayers.add(player.id);

    this.advanceTurn();
  }

  /**
   * 체크
   *
   * 현재까지 베팅된 금액과 자신의 베팅 금액이 같아야 합니다.
   */
  check(player: Player): void {
    this.checkTurn(player);

    if (this.currentBet !== 0) {
      throw new Error("현재 베팅이 진행 중이므로 체크할 수 없습니다.");
    }

    player.lastAction = "체크";

    this.actedPlayers.add(player.id);

    this.advanceTurn();
  }

  /**
   * 콜
   *
   * 현재 베팅 금액까지 맞춥니다.
   */
  call(player: Player): void {
    this.checkTurn(player);

    if (this.currentBet <= 0) {
      throw new Error("현재 베팅이 없습니다. 체크 또는 베팅을 사용하세요.");
    }

    const requiredAmount = this.currentBet - player.bet;

    if (requiredAmount <= 0) {
      throw new Error("이미 현재 베팅 금액과 동일합니다. 체크를 사용하세요.");
    }

    if (requiredAmount > player.chips) {
      throw new Error("칩이 부족해 콜할 수 없습니다. 올인을 사용하세요.");
    }

    if (requiredAmount > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다.");
    }

    player.chips -= requiredAmount;
    player.bet += requiredAmount;
    player.totalBet += requiredAmount;
    player.lastAction = "콜";

    this.deps.addToPot(requiredAmount);

    this.actedPlayers.add(player.id);

    this.advanceTurn();
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
   *
   * isHalf가 true면 "하프 레이즈" 액션이다 — 목표 금액(현재 베팅 금액 +
   * 판돈의 1/2)을 직접 계산하며, 호출자가 함께 넘긴 amount는 무시한다
   * (bet()의 isHalf와 같은 이유).
   */
  raise(player: Player, amount: number, isHalf: boolean): void {
    this.checkTurn(player);

    if (this.currentBet <= 0) {
      throw new Error("아직 베팅이 없습니다. 처음에는 베팅을 사용하세요.");
    }

    if (isHalf) {
      amount = this.currentBet + Math.max(1, Math.floor(this.deps.getPot() / 2));
    }

    if (amount <= this.currentBet) {
      throw new Error(
        `레이즈 금액은 현재 베팅 금액(${this.currentBet})보다 커야 합니다.`,
      );
    }

    const raiseSize = amount - this.currentBet;

    if (raiseSize < this.lastRaiseIncrement) {
      throw new Error(
        `최소 레이즈 금액은 ${(this.currentBet + this.lastRaiseIncrement).toLocaleString()} 이상이어야 합니다.`,
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

    this.deps.addToPot(additionalAmount);
    this.currentBet = amount;
    this.lastRaiseIncrement = raiseSize;

    // 레이즈가 발생했으므로 이전 행동 기록을 초기화
    this.actedPlayers.clear();
    this.actedPlayers.add(player.id);

    // 레이즈로 인해 다른 플레이어들은 다시 행동해야 하므로 표시된 행동도 지운다
    for (const p of this.players) {
      p.lastAction = null;
    }

    player.lastAction = `${isHalf ? "하프 레이즈" : "레이즈"} ${amount.toLocaleString()}`;

    this.advanceTurn();
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
  allIn(player: Player): void {
    this.checkTurn(player);

    const amount = Math.min(player.chips, player.maxBet - player.totalBet);

    if (amount <= 0) {
      throw new Error("더 이상 베팅할 수 없습니다.");
    }

    player.chips -= amount;
    player.bet += amount;
    player.totalBet += amount;

    this.deps.addToPot(amount);

    const label =
      player.chips === 0
        ? `올인 ${amount.toLocaleString()}`
        : `상한 도달 ${amount.toLocaleString()}`;

    if (player.bet > this.currentBet) {
      const raiseSize = player.bet - this.currentBet;

      this.currentBet = player.bet;

      // 콜을 넘어서는(=레이즈에 해당하는) 올인이므로 다른 사람들은 다시
      // 행동해야 한다. 다만 최소 레이즈 증가폭에 못 미치는 "불완전한" 올인
      // 레이즈라면 — 예: 남은 칩이 얼마 없어 어쩔 수 없이 조금만 더 얹은
      // 경우 — 최소 레이즈 기준 자체는 갱신하지 않는다.
      if (raiseSize >= this.lastRaiseIncrement) {
        this.lastRaiseIncrement = raiseSize;
      }

      this.actedPlayers.clear();

      for (const p of this.players) {
        p.lastAction = null;
      }
    }

    player.lastAction = label;

    this.actedPlayers.add(player.id);

    this.advanceTurn();
  }

  /**
   * 다이
   *
   * 상태 변경(status = "folded")은 게임 전체 규칙(팟 배분, 족보 판정 제외
   * 등)과 얽혀 있어 오케스트레이터가 맡고, 이 메서드는 다이가 이번 라운드의
   * 진행(누가 행동을 마쳤는지, 다음 차례)에 미치는 영향만 반영한다.
   */
  fold(player: Player): void {
    this.checkTurn(player);

    player.status = "folded";
    player.lastAction = "다이";

    this.actedPlayers.add(player.id);

    this.advanceTurn();
  }

  /**
   * 방 나가기 등으로 외부에서 이미 접기 처리된 플레이어를 이번 라운드의
   * "행동 완료" 목록에 반영하고 다음 차례로 넘어간다. 그 플레이어가 정확히
   * 지금 차례였을 때만 호출해야 한다(호출부에서 확인).
   */
  advanceAfterExternalFold(player: Player): void {
    this.actedPlayers.add(player.id);
    this.advanceTurn();
  }

  /**
   * 다음 플레이어로 이동하고 베팅 라운드가 끝났는지 검사한다.
   */
  private advanceTurn(): void {
    const activePlayers = this.players.filter(
      (player) => player.status === "playing",
    );

    // 다이를 해서 한 명만 남은 경우
    if (activePlayers.length <= 1) {
      this.deps.onHandCompleteByFold();
      return;
    }

    /*
     * 모든 살아있는 플레이어가
     *
     * 1. 현재 베팅 금액을 맞췄고
     * 2. 이번 라운드에서 행동을 완료했다면
     *
     * 라운드가 끝난다.
     */
    // 파산한(칩이 0인) 플레이어는 더 이상 베팅을 맞출 수 없으므로
    // 맞췄는지 여부와 무관하게 라운드 종료 조건을 통과한 것으로 본다.
    const allMatched = activePlayers.every(
      (player) => player.bet === this.currentBet || player.chips === 0,
    );

    const allActed = activePlayers.every((player) =>
      this.actedPlayers.has(player.id),
    );

    if (allMatched && allActed) {
      this.deps.onRoundComplete();
      return;
    }

    // 다음 살아있는 플레이어 찾기
    let nextIndex = this.currentPlayerIndex;

    do {
      nextIndex = (nextIndex + 1) % this.players.length;
    } while (this.players[nextIndex].status !== "playing");

    this.currentPlayerIndex = nextIndex;

    this.skipCurrentPlayerIfBroke();
  }

  /**
   * 현재 차례인 플레이어가 이미 파산(칩 0)해서 더 이상 베팅할 수 없는
   * 상태라면 자동 패스로 처리하고 다음 플레이어에게 차례를 넘긴다.
   *
   * advanceTurn()이 다음 플레이어를 찾은 직후뿐 아니라, 라운드가 막
   * 시작될 때(start())도 호출한다 — 그 라운드의 첫 차례부터 이미 파산
   * 상태인 플레이어일 수 있기 때문이다(예: 개인별 상한이 매우 낮아 앤티만
   * 으로 칩을 다 쓴 경우, 또는 지난 라운드에 올인해 이번 라운드에선 아예
   * 행동할 게 없는 경우).
   */
  private skipCurrentPlayerIfBroke(): void {
    const player = this.players[this.currentPlayerIndex];

    if (!player || player.status !== "playing") return;

    if (player.chips === 0 && !this.actedPlayers.has(player.id)) {
      player.lastAction = "올인 (자동 패스)";
      this.actedPlayers.add(player.id);
      this.advanceTurn();
    }
  }
}
