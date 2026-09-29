import { NextRequest, NextResponse } from "next/server";
import {
  callbackUrl,
  getProviderConfig,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/oauth";

// 네이버/카카오 로그인 시작 — 제공자의 동의 화면으로 보낸다.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = request.nextUrl.origin;
  const config = getProviderConfig(provider);

  if (!config?.clientId) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  const state = crypto.randomUUID();
  const url = new URL(config.authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrl(origin, provider));
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);

  // 콜백에서 state가 같은지 확인해 다른 사이트가 만든 로그인 요청을 막는다.
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });

  return response;
}
