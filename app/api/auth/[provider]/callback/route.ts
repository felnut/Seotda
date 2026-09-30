import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  callbackUrl,
  getProviderConfig,
  OAUTH_STATE_COOKIE,
  type OAuthProvider,
} from "@/lib/auth/oauth";
import {
  AccountError,
  createLoginToken,
  resolveAccount,
} from "@/lib/auth/accounts";
import { LINK_COOKIE, verifyIdToken } from "@/lib/auth/session";

// 제공자가 돌려준 코드를 액세스 토큰으로 바꿔 사용자를 확인한 뒤,
//  - 로그인이면: 그 사용자가 속한 내부 계정의 커스텀 토큰을 만들어 로그인 완료 페이지로,
//  - 계정 연결이면(설정에서 시작): 현재 계정에 이 로그인을 연결하고 로비로 보낸다.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = request.nextUrl.origin;
  const linkToken = request.cookies.get(LINK_COOKIE)?.value;
  const isLinking = !!linkToken;

  const redirect = (url: string) => {
    const response = NextResponse.redirect(url);

    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
    response.cookies.delete({ name: LINK_COOKIE, path: "/api/auth" });

    return response;
  };
  const fail = (error: string) =>
    redirect(
      isLinking
        ? `${origin}/?link_error=${error}`
        : `${origin}/login?error=${error}`,
    );

  const config = getProviderConfig(provider);

  if (!config?.clientId || !adminAuth) return fail("not_configured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get("error")) return fail("denied");
  if (!code || !state || state !== expectedState) return fail("state");

  try {
    const linkTo = isLinking ? await verifyIdToken(linkToken) : undefined;

    // 연결하려던 사용자의 로그인이 만료됐다면 로그인으로 취급하지 않고 멈춘다.
    if (isLinking && !linkTo) return fail("state");

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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) return fail("failed");

    const profile = await config.fetchProfile(tokenData.access_token);

    if (!profile.id) return fail("failed");

    const uid = await resolveAccount(
      provider as OAuthProvider,
      profile.id,
      profile.name,
      linkTo ?? undefined,
    );

    if (isLinking) return redirect(`${origin}/?linked=${provider}`);

    const customToken = await createLoginToken(uid, provider as OAuthProvider);

    // 토큰은 서버 로그·리퍼러에 남지 않도록 해시(#)로 넘긴다.
    return redirect(`${origin}/login/complete#token=${customToken}`);
  } catch (err) {
    if (err instanceof AccountError) return fail(err.code);

    console.error(`${provider} 로그인 실패:`, err);

    return fail("failed");
  }
}
