import { NextRequest, NextResponse } from "next/server";
import { deleteAccount } from "@/lib/auth/accounts";
import { getBearerUid } from "@/lib/auth/session";

// 회원 탈퇴 — 로그인한 본인의 계정과 모든 기록을 지운다.
export async function DELETE(request: NextRequest) {
  const uid = await getBearerUid(request);

  if (!uid) return NextResponse.json({ error: "state" }, { status: 401 });

  try {
    await deleteAccount(uid);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("회원 탈퇴 실패:", err);

    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
