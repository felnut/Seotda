import type { User } from "firebase/auth";
import type { StoredSession } from "./session";

interface RejoinSocket {
  connected: boolean;
  on(event: "connect", handler: () => void): unknown;
  off(event: "connect", handler: () => void): unknown;
  emit(event: "rejoin-room", payload: StoredSession & { idToken?: string }): unknown;
}

// 게스트 확정과 로그인 복원 대기를 구분하고, 새 소켓 연결마다 같은 좌석을 복원한다.
export function restoreRoomSession(
  socket: RejoinSocket,
  session: StoredSession | null,
  user: Pick<User, "getIdToken"> | null,
  authReady: boolean,
  onError: () => void,
): () => void {
  if (!authReady || !session) return () => {};

  let cancelled = false;

  const rejoin = async () => {
    try {
      const idToken = user ? await user.getIdToken() : undefined;

      if (!cancelled && socket.connected) {
        socket.emit("rejoin-room", { ...session, idToken });
      }
    } catch {
      if (!cancelled) onError();
    }
  };

  socket.on("connect", rejoin);
  if (socket.connected) void rejoin();

  return () => {
    cancelled = true;
    socket.off("connect", rejoin);
  };
}
