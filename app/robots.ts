import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 사용자 요청으로 탐색하는 AI 에이전트/검색 봇 - 허용
      {
        userAgent: [
          "ChatGPT-User",
          "Claude-User",
          "Perplexity-User",
          "OAI-SearchBot",
          "PerplexityBot",
        ],
        allow: "/",
      },
      // 학습 데이터 수집 등 검색 목적이 아닌 AI 크롤러 - 차단
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "CCBot",
          "Google-Extended",
          "Bytespider",
          "Meta-ExternalAgent",
          "Applebot-Extended",
          "Diffbot",
          "FacebookBot",
        ],
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "https://seotda.felnut.com/sitemap.xml",
  };
}
