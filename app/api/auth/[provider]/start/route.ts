import { NextRequest, NextResponse } from "next/server";
import {
  callbackUrl,
  getProviderConfig,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/oauth";
import { LINK_COOKIE } from "@/lib/auth/session";

// 네이버/카카오/깃허브 로그인 시작 — 제공자의 동의 화면으로 보낸다.
// ?link=1이면 설정에서 시작한 계정 연결이라 link-start가 심어둔 쿠키를 그대로 쓰고,
// 아니면 예전에 중단된 연결 시도의 쿠키가 이번 로그인에 섞이지 않게 지운다.
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

  if (request.nextUrl.searchParams.get("link") !== "1") {
    response.cookies.delete({ name: LINK_COOKIE, path: "/api/auth" });
  }

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
