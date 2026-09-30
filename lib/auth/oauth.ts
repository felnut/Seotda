// 네이버·카카오·깃허브 로그인 — 서버에서 OAuth 코드를 교환해 사용자를
// 확인하고, 내부 계정(lib/auth/accounts.ts)의 파이어베이스 커스텀 토큰을
// 만들어준다. (구글은 클라이언트가 받은 ID 토큰을 /api/auth/google이 검증한다.)

export type OAuthProvider = "naver" | "kakao" | "github";

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
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // 깃허브 API는 User-Agent가 없으면 요청을 거절한다.
      "User-Agent": "seotda",
    },
  });

  if (!response.ok) throw new Error(`profile ${response.status}`);

  return response.json();
}

const PROVIDERS: Record<OAuthProvider, () => ProviderConfig> = {
  github: () => ({
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const data = await getJson("https://api.github.com/user", accessToken);

      return {
        id: String(data.id ?? ""),
        name: String(data.name ?? data.login ?? "깃허브 사용자"),
      };
    },
  }),
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
  return Object.hasOwn(PROVIDERS, provider)
    ? PROVIDERS[provider as OAuthProvider]()
    : null;
}

export const OAUTH_STATE_COOKIE = "seotda-oauth-state";

export function callbackUrl(origin: string, provider: string): string {
  return `${origin}/api/auth/${provider}/callback`;
}
