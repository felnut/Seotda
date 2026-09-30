import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  getLinkedProviders,
  LOGIN_PROVIDERS,
  unlinkProvider,
  type LoginProvider,
} from "@/lib/auth/accounts";
import { getBearerUid } from "@/lib/auth/session";

// 내 계정에 연결된 로그인 방식 조회 / 해제.
export async function GET(request: NextRequest) {
  const uid = await getBearerUid(request);

  if (!uid) return NextResponse.json({ error: "state" }, { status: 401 });

  try {
    return NextResponse.json({ linked: await getLinkedProviders(uid) });
  } catch (err) {
    console.error("연결된 로그인 조회 실패:", err);

    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const uid = await getBearerUid(request);

  if (!uid) return NextResponse.json({ error: "state" }, { status: 401 });

  const provider = request.nextUrl.searchParams.get(
    "provider",
  ) as LoginProvider | null;

  if (!provider || !LOGIN_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }

  try {
    await unlinkProvider(uid, provider);

    return NextResponse.json({ linked: await getLinkedProviders(uid) });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }

    console.error("로그인 연결 해제 실패:", err);

    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
