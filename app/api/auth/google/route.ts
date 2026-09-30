import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  createLoginToken,
  resolveAccount,
} from "@/lib/auth/accounts";
import { getBearerUid } from "@/lib/auth/session";

// 구글은 브라우저가 Google Identity Services로 액세스 토큰을 받아 이 API에 보낸다.
// 토큰이 우리 앱용으로 발급된 진짜인지 구글에 확인한 뒤 내부 계정을 찾는다.
//  - Authorization 헤더 없음: 로그인 → { token } (커스텀 토큰)
//  - 로그인한 사용자의 Bearer 토큰 있음: 그 계정에 구글을 연결 → { linked: true }
export async function POST(request: NextRequest) {
  const { accessToken } = (await request.json().catch(() => ({}))) as {
    accessToken?: string;
  };

  if (!accessToken) {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }

  // 1) 이 토큰이 우리 앱(클라이언트 ID)에게 발급된 것인지 확인한다 — 다른 앱에서
  //    받은 토큰을 가져와 쓰는 것을 막는다.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  const tokenInfo = tokenInfoResponse.ok ? await tokenInfoResponse.json() : null;

  if (!clientId || !tokenInfo || (tokenInfo.aud ?? tokenInfo.azp) !== clientId) {
    return NextResponse.json({ error: "failed" }, { status: 401 });
  }

  // 2) 그 토큰의 주인이 누구인지(sub = 구글 계정 고유 ID)와 이름을 읽는다.
  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const info = profileResponse.ok ? await profileResponse.json() : null;

  if (!info?.sub) {
    return NextResponse.json({ error: "failed" }, { status: 401 });
  }

  const wantsLink = request.headers.has("authorization");
  const linkTo = wantsLink ? await getBearerUid(request) : null;

  if (wantsLink && !linkTo) {
    return NextResponse.json({ error: "state" }, { status: 401 });
  }

  try {
    const uid = await resolveAccount(
      "google",
      String(info.sub),
      String(info.name ?? info.given_name ?? "구글 사용자"),
      linkTo ?? undefined,
    );

    if (linkTo) return NextResponse.json({ linked: true });

    return NextResponse.json({ token: await createLoginToken(uid, "google") });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }

    console.error("google 로그인 실패:", err);

    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
