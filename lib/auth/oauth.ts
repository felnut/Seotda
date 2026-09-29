// 네이버·카카오 로그인 — 파이어베이스가 기본으로 지원하지 않는 제공자라서
// 서버에서 OAuth 코드를 교환하고 파이어베이스 커스텀 토큰을 만들어준다.

export type OAuthProvider = "naver" | "kakao";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  // 액세스 토큰으로 사용자 고유 id와 표시 이름을 가져온다.
  fetchProfile: (accessToken: string) => Promise<{ id: string; name: string }>;
}

async function getJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`profile ${response.status}`);

  return response.json();
}

const PROVIDERS: Record<OAuthProvider, () => ProviderConfig> = {
  naver: () => ({
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const data = await getJson(
        "https://openapi.naver.com/v1/nid/me",
        accessToken,
      );
      const profile = data.response ?? {};

      return {
        id: String(profile.id ?? ""),
        name: String(profile.nickname ?? profile.name ?? "네이버 사용자"),
      };
    },
  }),
  kakao: () => ({
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    clientId: process.env.KAKAO_REST_API_KEY,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const data = await getJson(
        "https://kapi.kakao.com/v2/user/me",
        accessToken,
      );

      return {
        id: String(data.id ?? ""),
        name: String(
          data.kakao_account?.profile?.nickname ??
            data.properties?.nickname ??
            "카카오 사용자",
        ),
      };
    },
  }),
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  return provider in PROVIDERS
    ? PROVIDERS[provider as OAuthProvider]()
    : null;
}

export const OAUTH_STATE_COOKIE = "seotda-oauth-state";

export function callbackUrl(origin: string, provider: string): string {
  return `${origin}/api/auth/${provider}/callback`;
}
