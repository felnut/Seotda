import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  callbackUrl,
  getProviderConfig,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/oauth";

// 제공자가 돌려준 코드를 액세스 토큰으로 바꾸고, 그 계정에 대응하는
// 파이어베이스 커스텀 토큰을 만들어 로그인 완료 페이지로 보낸다.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = request.nextUrl.origin;
  const fail = (error: string) => {
    const response = NextResponse.redirect(`${origin}/login?error=${error}`);

    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });

    return response;
  };

  const config = getProviderConfig(provider);

  if (!config?.clientId || !adminAuth) return fail("not_configured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get("error")) return fail("denied");
  if (!code || !state || state !== expectedState) return fail("state");

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: callbackUrl(origin, provider),
      code,
      state,
    });

    if (config.clientSecret) body.set("client_secret", config.clientSecret);

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) return fail("failed");

    const profile = await config.fetchProfile(tokenData.access_token);

    if (!profile.id) return fail("failed");

    const uid = `${provider}:${profile.id}`;

    // 처음 로그인하는 계정만 만들고, 표시 이름은 그때 한 번만 채운다.
    // (이후에는 사용자가 프로필에서 바꾼 닉네임이 우선한다.)
    try {
      await adminAuth.getUser(uid);
    } catch {
      await adminAuth.createUser({
        uid,
        displayName: profile.name.slice(0, 13),
      });
    }

    const customToken = await adminAuth.createCustomToken(uid, { provider });
    // 토큰은 서버 로그·리퍼러에 남지 않도록 해시(#)로 넘긴다.
    const response = NextResponse.redirect(
      `${origin}/login/complete#token=${customToken}`,
    );

    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });

    return response;
  } catch (err) {
    console.error(`${provider} 로그인 실패:`, err);

    return fail("failed");
  }
}
