import type { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

// 링크 시작 시 브라우저가 심어두는 쿠키 — 네이버/카카오/깃허브의 리다이렉트
// 왕복 동안 "누가 연결을 요청했는지"를 기억하기 위해 쓴다.
export const LINK_COOKIE = "seotda-link";

// 로그인한 브라우저가 보낸 파이어베이스 ID 토큰을 검증해 계정 uid를 돌려준다.
export async function verifyIdToken(token: string | undefined | null) {
  if (!token || !adminAuth) return null;

  try {
    return (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export function getBearerUid(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";

  return verifyIdToken(header.startsWith("Bearer ") ? header.slice(7) : null);
}
