import { NextRequest, NextResponse } from "next/server";
import { getBearerUid, LINK_COOKIE } from "@/lib/auth/session";

// 설정에서 "연결" 버튼을 누르면 먼저 이 API를 부른다. 로그인한 사용자의 ID 토큰을
// 짧게 유지되는 쿠키에 담아두면, 제공자 로그인 후 콜백이 "이 로그인을 누구
// 계정에 붙일지" 알 수 있다.
export async function POST(request: NextRequest) {
  const uid = await getBearerUid(request);

  if (!uid) return NextResponse.json({ error: "state" }, { status: 401 });

  const response = NextResponse.json({ ok: true });

  response.cookies.set(
    LINK_COOKIE,
    (request.headers.get("authorization") ?? "").slice(7),
    {
      httpOnly: true,
      secure: request.nextUrl.origin.startsWith("https"),
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 600,
    },
  );

  return response;
}
