import { CARDS } from "./cards";
import { SeotdaCard } from "@/types/seotda";

export class Deck {
  private cards: SeotdaCard[];

  constructor() {
    this.cards = [...CARDS];
    this.shuffle();
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(count: number = 1): SeotdaCard[] {
    if (count < 1) {
      throw new Error("뽑을 카드의 수는 1장 이상이어야 합니다.");
    }

    if (count > this.cards.length) {
      throw new Error("덱에 카드가 부족합니다.");
    }

    return this.cards.splice(0, count);
  }

  get remaining(): number {
    return this.cards.length;
  }

  reset(): void {
    this.cards = [...CARDS];
    this.shuffle();
  }
}
