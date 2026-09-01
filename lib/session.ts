// 새로고침이나 페이지 이동 후에도 방에 다시 접속(rejoin-room)할 수 있도록
// 브라우저 세션에 남겨두는 최소 정보. 여러 페이지(홈, 방 찾기)가 공유한다.

const SESSION_STORAGE_KEY = "seotda-session";

export interface StoredSession {
  roomId: string;
  playerId: string;
  rejoinToken: string;
}

export function saveSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
  const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!saved) return null;

  try {
    const session = JSON.parse(saved) as StoredSession;

    if (!session.roomId || !session.playerId || !session.rejoinToken) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
