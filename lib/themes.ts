export const THEME_STORAGE_KEY = "seotda-theme";
export const DEFAULT_THEME = "ink";

export interface ThemeMeta {
  id: string;
  label: string;
  description: string;
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  { id: "ink", label: "먹", description: "기본 · 깊은 먹색과 붉은 포인트", swatch: ["#171a19", "#e8e1d5", "#e07361"] },
  { id: "paper", label: "한지", description: "따뜻한 바탕의 밝은 테마", swatch: ["#f4f0e7", "#242923", "#ad4939"] },
  { id: "pine", label: "솔", description: "차분한 녹색의 카드 테이블", swatch: ["#102a24", "#ece6d9", "#d8ba7e"] },
];
