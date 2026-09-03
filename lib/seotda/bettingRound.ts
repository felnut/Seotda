import { Player } from "./types";

// 팟 대비 "지금 추가로 낼 금액"의 배율 — 하프는 팟의 1/2, 쿼터는 팟의
// 1/4, 더블은 팟의 2배를 그대로 낸다. 베팅을 여는 것이든 레이즈든 같은
// 공식 하나(현재 팟 × 배율)이며, 지금 최고 베팅액이 얼마인지는 신경
// 쓰지 않는다. 최소 레이즈 증가폭 같은 규칙이 필요 없어져 로직이
// 단순해진다.
//
// 예: 판돈 1,000 → 하프 500 / 쿼터 250 / 더블 2,000
export const RAISE_RATIOS = {
  half: 0.5,
  quarter: 0.25,
  double: 2,
} as const;

export type RaiseRatio = keyof typeof RAISE_RATIOS;

const RAISE_LABELS: Record<RaiseRatio, string> = {
  half: "하프",
  quarter: "쿼터",
  double: "더블",
};

// 베팅 라운드 하나(1차 또는 2차)의 진행을 전담한다 — 순서, 상한, 파산
// 플레이어 자동 패스까지 전부 이 클래스 안에서 처리한다. 라운드가 끝나야만
// 알 수 있는 다음 단계(카드 공개로 넘어갈지, 쇼다운으로 넘어갈지)나 다이로
// 인해 판 자체가 끝나는 경우는 이 클래스의 책임이 아니므로, 그 시점에
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
   * 체크
   *
   * 현재까지 베팅된 금액과 자신의 베팅 금액이 같아야 합니다.
   */
  check(player: Player): void {
    this.checkTurn(player);

    if (player.bet !== this.currentBet) {
      throw new Error("현재 베팅이 진행 중이므로 체크할 수 없습니다.");
    }

    player.lastAction = "체크";

    this.actedPlayers.add(player.id);

    this.advanceTurn();
  }

  /**
   * 콜
   *
   * 현재 최고 베팅 금액까지 자신의 베팅 금액을 맞춘다.
   */
  call(player: Player): void {
    this.checkTurn(player);

    if (this.currentBet <= 0) {
      throw new Error(
        "현재 베팅이 없습니다. 체크 또는 하프/쿼터/더블을 사용하세요.",
      );
    }

    const requiredAmount = this.currentBet - player.bet;

    if (requiredAmount <= 0) {
      throw new Error("이미 현재 베팅 금액과 동일합니다. 체크를 사용하세요.");
    }

    if (requiredAmount > player.chips) {
      throw new Error("칩이 부족해 콜할 수 없습니다. 올인을 사용하세요.");
    }

    if (requiredAmount > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다. 올인을 사용하세요.");
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
   * 하프/쿼터/더블 — 베팅을 열 때든 레이즈할 때든 같은 공식 하나로 처리한다.
   *
   * 이 액션의 크기 = 현재 팟 × 배율(1/2, 1/4, 2배). 베팅을 여는 것이라면
   * (currentBet=0) 그 금액 자체가 이번 라운드 베팅 총액이 되고, 레이즈라면
   * 현재 최고 베팅액 위에 그 크기만큼을 얹는다 — 안 그러면 이미 걸린
   * 베팅이 큰 상황에서 하프/쿼터가 그보다 작게 계산돼 아예 낼 수 없는
   * 경우가 생긴다.
   */
  raiseByRatio(player: Player, ratio: RaiseRatio): void {
    this.checkTurn(player);

    const raiseSize = Math.floor(this.deps.getPot() * RAISE_RATIOS[ratio]);

    if (raiseSize <= 0) {
      throw new Error("지금은 판돈이 작아 이 베팅을 쓸 수 없습니다.");
    }

    const target = this.currentBet + raiseSize;
    const amountToPay = target - player.bet;

    if (amountToPay > player.chips) {
      throw new Error("칩이 부족합니다. 올인을 사용하세요.");
    }

    if (amountToPay > player.maxBet - player.totalBet) {
      throw new Error("판당 최대 베팅 금액을 초과했습니다. 올인을 사용하세요.");
    }

    player.chips -= amountToPay;
    player.bet = target;
    player.totalBet += amountToPay;

    this.deps.addToPot(amountToPay);
    this.currentBet = target;

    // 베팅액이 갱신됐으므로 다른 플레이어들은 다시 행동해야 한다.
    this.actedPlayers.clear();
    this.actedPlayers.add(player.id);

    for (const p of this.players) {
      p.lastAction = null;
    }

    player.lastAction = `${RAISE_LABELS[ratio]} ${raiseSize.toLocaleString()}`;

    this.advanceTurn();
  }

  /**
   * 올인
   *
   * 남은 칩을 전부 베팅한다. 판당 최대 베팅 금액(maxBet)의 유일한 예외로,
   * 이 한도를 넘어서도 걸 수 있다. 그 금액이 currentBet에 못 미치더라도
   * (=완전히 콜하기엔 부족한 올인) 거부하지 않고 있는 만큼만 베팅한다 —
   * 보유 칩이 적은 플레이어가 큰 판에서도 정상적으로 승부에 참여할 수
   * 있게 하는 유일한 방법이다. 이렇게 서로 다른 금액으로 올인이 발생하면
   * potManager.buildPots()가 쇼다운에서 메인 팟/사이드 팟으로 나눈다.
   */
  allIn(player: Player): void {
    this.checkTurn(player);

    const amount = player.chips;

    if (amount <= 0) {
      throw new Error("더 이상 베팅할 수 없습니다.");
    }

    player.chips -= amount;
    player.bet += amount;
    player.totalBet += amount;

    this.deps.addToPot(amount);

    if (player.bet > this.currentBet) {
      // 콜을 넘어서는(=레이즈에 해당하는) 올인이므로 다른 사람들은 다시
      // 행동해야 한다.
      this.currentBet = player.bet;

      this.actedPlayers.clear();

      for (const p of this.players) {
        p.lastAction = null;
      }
    }

    player.lastAction = `올인 ${amount.toLocaleString()}`;

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
