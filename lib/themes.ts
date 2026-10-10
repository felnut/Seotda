// 런타임에 고를 수 있는 테마 목록. 값은 app/themes.css 에 있습니다(자동 생성).
export const THEME_STORAGE_KEY = "seotda-theme";
export const MODE_STORAGE_KEY = "seotda-mode";
export const DEFAULT_THEME = "cursor";

export interface ThemeMeta {
  id: string;
  label: string;
  // 원래 모습이 밝은 테마인지 (true면 기본이 화이트, 반대 모드가 다크)
  nativeLight: boolean;
  // 목록에 보이는 색 점 — [바탕, 주요 버튼, 포인트]
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    "id": "airbnb",
    "label": "Airbnb",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#ff385c",
      "#222222"
    ]
  },
  {
    "id": "airtable",
    "label": "Airtable",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#181d26",
      "#006400"
    ]
  },
  {
    "id": "apple",
    "label": "Apple",
    "nativeLight": true,
    "swatch": [
      "#f5f5f7",
      "#0066cc",
      "#248a3d"
    ]
  },
  {
    "id": "bmw",
    "label": "BMW",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#1c69d4",
      "#1a8a3c"
    ]
  },
  {
    "id": "bmw-m",
    "label": "BMW M",
    "nativeLight": false,
    "swatch": [
      "#000000",
      "#ffffff",
      "#5aa0ff"
    ]
  },
  {
    "id": "bugatti",
    "label": "Bugatti",
    "nativeLight": false,
    "swatch": [
      "#000000",
      "#ffffff",
      "#5fa657"
    ]
  },
  {
    "id": "cal",
    "label": "Cal",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#111111",
      "#059669"
    ]
  },
  {
    "id": "clay",
    "label": "Clay",
    "nativeLight": true,
    "swatch": [
      "#fffaf0",
      "#0a0a0a",
      "#15803d"
    ]
  },
  {
    "id": "clickhouse",
    "label": "ClickHouse",
    "nativeLight": false,
    "swatch": [
      "#0a0a0a",
      "#faff69",
      "#22c55e"
    ]
  },
  {
    "id": "coinbase",
    "label": "Coinbase",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#0052ff",
      "#05b169"
    ]
  },
  {
    "id": "composio",
    "label": "Composio",
    "nativeLight": false,
    "swatch": [
      "#0f0f0f",
      "#1a26ff",
      "#33d17a"
    ]
  },
  {
    "id": "cursor",
    "label": "Cursor",
    "nativeLight": true,
    "swatch": [
      "#f7f7f4",
      "#f54e00",
      "#1f8a65"
    ]
  },
  {
    "id": "dell",
    "label": "Dell",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#fcc20f",
      "#55631f"
    ]
  },
  {
    "id": "discord",
    "label": "Discord",
    "nativeLight": false,
    "swatch": [
      "#14184a",
      "#5865f2",
      "#35ed7e"
    ]
  },
  {
    "id": "ferrari",
    "label": "Ferrari",
    "nativeLight": false,
    "swatch": [
      "#181818",
      "#da291c",
      "#1fb866"
    ]
  },
  {
    "id": "figma",
    "label": "Figma",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#000000",
      "#1ea64a"
    ]
  },
  {
    "id": "framer",
    "label": "Framer",
    "nativeLight": false,
    "swatch": [
      "#090909",
      "#ffffff",
      "#22c55e"
    ]
  },
  {
    "id": "hashicorp",
    "label": "HashiCorp",
    "nativeLight": false,
    "swatch": [
      "#000000",
      "#ffffff",
      "#00ca8e"
    ]
  },
  {
    "id": "intercom",
    "label": "Intercom",
    "nativeLight": true,
    "swatch": [
      "#f5f1ec",
      "#111111",
      "#0a8f3a"
    ]
  },
  {
    "id": "kraken",
    "label": "Kraken",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#7132f5",
      "#026b3f"
    ]
  },
  {
    "id": "linear",
    "label": "Linear",
    "nativeLight": false,
    "swatch": [
      "#010102",
      "#5e6ad2",
      "#27a644"
    ]
  },
  {
    "id": "lovable",
    "label": "Lovable",
    "nativeLight": true,
    "swatch": [
      "#f7f4ed",
      "#1c1c1c",
      "#1f8a4c"
    ]
  },
  {
    "id": "minimax",
    "label": "MiniMax",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#0a0a0a",
      "#1ba673"
    ]
  },
  {
    "id": "mintlify",
    "label": "Mintlify",
    "nativeLight": true,
    "swatch": [
      "#d9e5f1",
      "#0a0a0a",
      "#1ba673"
    ]
  },
  {
    "id": "miro",
    "label": "Miro",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#1c1c1e",
      "#00b473"
    ]
  },
  {
    "id": "mobbin",
    "label": "Mobbin",
    "nativeLight": true,
    "swatch": [
      "#ffffff",
      "#141414",
      "#16a34a"
    ]
  }
];
