export const RANKINGS_COLLECTION = "rankings";

export interface RankingEntry {
  name: string;
  money: number;
  peakChips: number;
  wins: number;
  gamesPlayed: number;
  winRate: number;
  updatedAt: number;
}

export interface RankingMetric {
  field: keyof Omit<RankingEntry, "name" | "updatedAt">;
  label: string;
  format: (entry: RankingEntry) => string;
}

export const RANKING_METRICS: RankingMetric[] = [
  {
    field: "money",
    label: "보유 머니",
    format: (e) => `${e.money.toLocaleString()}`,
  },
  {
    field: "peakChips",
    label: "최고 보유 칩",
    format: (e) => `${e.peakChips.toLocaleString()}`,
  },
  {
    field: "wins",
    label: "승리 수",
    format: (e) => `${e.wins.toLocaleString()}승`,
  },
  {
    field: "winRate",
    label: "승률",
    format: (e) => `${Math.round(e.winRate * 100)}% (${e.gamesPlayed}전 ${e.wins}승)`,
  },
  {
    field: "gamesPlayed",
    label: "총 게임 수",
    format: (e) => `${e.gamesPlayed.toLocaleString()}판`,
  },
];
