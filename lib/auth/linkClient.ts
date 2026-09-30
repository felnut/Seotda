// 브라우저에서 계정 연결 API를 부르는 도우미 (로그인한 사용자의 ID 토큰을 붙인다).
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { LoginProvider } from "@/lib/auth/accounts";
import { authErrorMessage } from "@/lib/auth/messages";

export type LinkedProviders = Record<LoginProvider, boolean>;

async function authedFetch(input: string, init: RequestInit = {}) {
  const auth = await getFirebaseAuth();
  const idToken = await auth?.currentUser?.getIdToken();

  if (!idToken) throw new Error("not signed in");

  return fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${idToken}` },
  });
}

export async function fetchLinkedProviders(): Promise<LinkedProviders> {
  const response = await authedFetch("/api/auth/identities");
  const data = await response.json();

  if (!response.ok) throw new Error(authErrorMessage(data.error));

  return data.linked;
}

export async function unlinkLoginProvider(
  provider: LoginProvider,
): Promise<LinkedProviders> {
  const response = await authedFetch(
    `/api/auth/identities?provider=${provider}`,
    { method: "DELETE" },
  );
  const data = await response.json();

  if (!response.ok) throw new Error(authErrorMessage(data.error));

  return data.linked;
}

// 네이버/카카오/깃허브 연결 — 누구 계정에 붙일지 기억시킨 뒤 제공자 화면으로 이동한다.
export async function startLoginLink(provider: "naver" | "kakao" | "github") {
  const response = await authedFetch("/api/auth/link-start", {
    method: "POST",
  });

  if (!response.ok) throw new Error(authErrorMessage("state"));

  // API 라우트라 클라이언트 라우터가 아니라 일반 이동이 필요하다.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/api/auth/${provider}/start?link=1`);
}

// 회원 탈퇴 — 서버가 계정과 모든 기록을 지운다. 성공하면 호출한 쪽에서 로그아웃한다.
export async function deleteMyAccount(): Promise<void> {
  const response = await authedFetch("/api/auth/account", {
    method: "DELETE",
  });

  if (!response.ok) throw new Error(authErrorMessage("failed"));
}
