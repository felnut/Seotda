import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  createLoginToken,
  resolveAccount,
} from "@/lib/auth/accounts";
import { getBearerUid } from "@/lib/auth/session";

// 구글은 브라우저가 Google Identity Services로 ID 토큰을 받아 이 API에 보낸다.
// 토큰이 우리 앱용으로 발급된 진짜인지 구글에 확인한 뒤 내부 계정을 찾는다.
//  - Authorization 헤더 없음: 로그인 → { token } (커스텀 토큰)
//  - 로그인한 사용자의 Bearer 토큰 있음: 그 계정에 구글을 연결 → { linked: true }
export async function POST(request: NextRequest) {
  const { credential } = (await request.json().catch(() => ({}))) as {
    credential?: string;
  };

  if (!credential) {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }

  const verifyResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  const info = verifyResponse.ok ? await verifyResponse.json() : null;

  if (
    !info?.sub ||
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    info.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  ) {
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
