import { Deck } from "./deck";
import { HAND_RANK, HandResult } from "./ranking";
import { Player } from "./types";

/**
 * 구사/멍텅구리 구사로 인한 재경기를 전담한다.
 *
 * 재경기는 앤티나 베팅을 새로 만들지 않는 즉시 승부다(34장) — 다이한
 * 사람은 제외하고, 남은 참가자에게만 새 카드 2장을 배분해 곧바로 다시
 * 비교한다. 기존 판돈은 그대로 유지된다(판돈 자체는 오케스트레이터가
 * 관리하며 이 클래스는 건드리지 않는다).
 */
export class RematchResolver {
  private pending: { reason: string; activePlayerIds: string[] } | null =
    null;

  /**
   * 구사 / 멍텅구리 구사 재경기 조건을 판정한다. 무조건 재경기가 아니라,
   * 다른 참가자 중 아무도 기준패(구사=알리, 멍텅구리 구사=9땡)를 넘는
   * 패가 없을 때만 판을 무효로 하고 재경기한다. 누군가 기준을 넘는 패를
   * 들고 있으면 재경기 없이 구사류는 망통과 같은 순위로 그냥 진다.
   *
   * 조건을 만족하면 재경기 사유를 반환하며 내부에 대기 상태로 기록해두고,
   * 아니면 null을 반환한다.
   */
  detect(
    activePlayers: Player[],
    results: Map<string, HandResult>,
  ): string | null {
    for (const player of activePlayers) {
      const special = results.get(player.id)!.special;

      if (special !== "gusa" && special !== "meongtunguri-gusa") continue;

      const threshold =
        special === "gusa" ? HAND_RANK.ALI : HAND_RANK.NINE_DDAENG;

      const someoneExceedsThreshold = activePlayers.some(
        (other) =>
          other.id !== player.id && results.get(other.id)!.rank > threshold,
      );

      if (!someoneExceedsThreshold) {
        const reason =
          special === "meongtunguri-gusa" ? "멍텅구리 구사" : "구사";

        this.pending = {
          reason,
          activePlayerIds: activePlayers.map((p) => p.id),
        };

        return reason;
      }
    }

    return null;
  }

  /**
   * 재경기 대기 중인지 여부 — true면 패를 충분히 보여준 뒤 confirm()을
   * 불러야 한다.
   */
  hasPending(): boolean {
    return this.pending !== null;
  }

  /**
   * 대기 중이던 재경기를 실제로 진행한다. 다이하지 않은 참가자에게 새
   * 카드 2장을 배분하고(3번째 카드 없이 그대로 결과 패로 쓴다), 그 참가자
   * 목록을 반환한다 — 호출부가 이 목록으로 다시 승부를 판정해야 한다.
   */
  confirm(deck: Deck, findPlayer: (id: string) => Player): Player[] {
    if (!this.pending) return [];

    const { activePlayerIds } = this.pending;

    this.pending = null;

    const participants = activePlayerIds.map(findPlayer);

    deck.reset();

    for (const player of participants) {
      player.cards = deck.draw(2);
      player.selectedIndices = [0, 1];
      player.revealedCardIndex = null;
      player.bet = 0;
      player.lastAction = null;
    }

    return participants;
  }
}
