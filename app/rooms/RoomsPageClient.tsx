"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoomInfo, RoomListEntry } from "@/types/seotda";
import { socket } from "@/lib/socket";
import { saveSession } from "@/lib/session";
import { loadNickname } from "@/lib/nickname";
import { useAuth } from "@/lib/useAuth";
import { EmptyState } from "../components/EmptyState";

export function RoomsPageClient() {
  const router = useRouter();
  const user = useAuth();

  const [roomList, setRoomList] = useState<RoomListEntry[]>([]);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const pendingJoinCleanup = useRef<(() => void) | null>(null);

  // 비밀번호가 걸린 방을 클릭했을 때 팝업으로 띄우는 입력창의 대상 방
  const [passwordPromptRoom, setPasswordPromptRoom] =
    useState<RoomListEntry | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // 방 목록을 주기적으로 새로 받아온다.
  useEffect(() => {
    const fetchRoomList = () => socket.emit("list-rooms");

    fetchRoomList();

    const interval = window.setInterval(fetchRoomList, 4000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRoomList = (list: RoomListEntry[]) => {
      setRoomList(list);
    };
    socket.on("rooms-list", handleRoomList);

    return () => {
      socket.off("rooms-list", handleRoomList);
      pendingJoinCleanup.current?.();
    };
  }, []);

  const joinRoom = async (roomId: string, password?: string) => {
    if (isJoining || pendingJoinCleanup.current) return;

    setIsJoining(true);
    setError("");
    setPasswordError("");

    const handleJoined = (info: RoomInfo) => {
      if (info.roomId !== roomId) return;
      cleanup();

      saveSession({
        roomId: info.roomId,
        playerId: info.playerId,
        rejoinToken: info.rejoinToken,
      });

      router.push("/");
    };

    const handleError = ({ message }: { message: string }) => {
      cleanup();
      setIsJoining(false);

      if (password !== undefined) {
        setPasswordError(message);
      } else {
        setError(message);
      }
    };

    const handleDisconnect = () => {
      handleError({ message: "서버 연결이 끊겼어요. 연결 후 다시 입장해주세요." });
    };

    // 토큰 갱신이나 서버 응답이 끝나지 않아도 입장 버튼을 다시 쓸 수 있게 한다.
    const timeout = window.setTimeout(() => {
      handleError({ message: "입장 응답이 지연되고 있어요. 다시 시도해주세요." });
      // 이미 보낸 입장이 뒤늦게 좌석을 만들지 않도록 이전 연결을 종료한다.
      // 서버는 인증 조회 뒤 연결 상태를 다시 검사해 취소된 입장을 거부한다.
      socket.disconnect().connect();
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off("room-joined", handleJoined);
      socket.off("error-message", handleError);
      socket.off("disconnect", handleDisconnect);
      if (pendingJoinCleanup.current === cleanup) pendingJoinCleanup.current = null;
    };

    pendingJoinCleanup.current = cleanup;
    socket.on("room-joined", handleJoined);
    socket.on("error-message", handleError);
    socket.on("disconnect", handleDisconnect);

    try {
      const idToken = user ? await user.getIdToken() : undefined;
      // 갱신 중 화면을 떠났거나 제한 시간을 넘겼다면 뒤늦게 입장하지 않는다.
      if (pendingJoinCleanup.current !== cleanup) return;
      if (!socket.connected) {
        handleDisconnect();
        return;
      }

      socket.emit("join-room", {
        roomId,
        name: loadNickname().trim() || undefined,
        password: password?.trim() || undefined,
        idToken,
      });
    } catch {
      if (pendingJoinCleanup.current === cleanup) {
        handleError({ message: "로그인 정보를 확인하지 못했어요. 다시 시도해주세요." });
      }
    }
  };

  const handleRoomClick = (room: RoomListEntry) => {
    if (room.playerCount >= room.maxPlayers) return;

    if (room.hasPassword) {
      setPasswordPromptRoom(room);
      setPasswordInput("");
      setPasswordError("");
      return;
    }

    joinRoom(room.roomId);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:py-14">
      <Link
        href="/"
        className="mb-6 inline-block w-fit text-[13.5px] text-zinc-500 hover:text-zinc-300"
      >
        ← 메인으로
      </Link>

      <div className="rooms-heading">
        <div><p className="eyebrow">함께할 테이블</p><h1>어느 방에 앉을까요?</h1><p>친구의 방을 찾거나, 새로운 한 판에 함께하세요.</p></div>
        <Link href="/" className="primary-action w-auto!">새 방 만들기 <span aria-hidden="true">＋</span></Link>
      </div>
      <div className="rooms-toolbar"><span>열린 방 <strong>{roomList.length}</strong></span><span>4초마다 자동 업데이트</span></div>
      <div className="rooms-grid">
        {roomList.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center pb-6">
            <EmptyState title="아직 열린 테이블이 없어요" subtitle="위의 ‘새 방 만들기’로 첫 테이블을 열어보세요. 로비에서 AI와 혼자 시작할 수도 있어요." />
          </div>
        )}

        {roomList.map((room) => {
          const isFull = room.playerCount >= room.maxPlayers;

          return (
            <button
              key={room.roomId}
              type="button"
              onClick={() => handleRoomClick(room)}
              disabled={isJoining || isFull}
              className="room-tile animate-fade-up"
            >
              <span className="flex min-w-0 flex-col items-start gap-3">
                <span className="truncate text-[17px] font-semibold text-zinc-100">
                  {room.hasPassword ? "🔒 " : ""}
                  {room.name}
                </span>

                {room.inProgress && (
                  <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[12.5px] font-bold text-black">
                    진행 중 · 관전으로 참가
                  </span>
                )}
              </span>

              <span className="shrink-0 font-mono text-[15px] tabular-nums text-zinc-500">
                {isFull
                  ? "가득 참"
                  : `${room.playerCount}/${room.maxPlayers}명`}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="animate-fade-up mt-6 rounded-xl border border-crimson/40 bg-crimson/10 p-4 text-center text-[17.5px] font-medium text-crimson-bright">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-zinc-500">진행 중인 방은 먼저 관전하고, 다음 판부터 참가할 수 있어요.</p>

      {passwordPromptRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPasswordPromptRoom(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
            onKeyDown={(event) => { if (event.key === "Escape") setPasswordPromptRoom(null); }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom(passwordPromptRoom.roomId, passwordInput);
            }}
            className="animate-pop-in w-full max-w-xs rounded-2xl border border-hairline bg-zinc-950 p-6"
          >
            <h2 id="password-dialog-title" className="mb-1 text-[19px] font-bold">
              🔒 {passwordPromptRoom.name}
            </h2>

            <p className="mb-4 text-[14px] text-zinc-500">
              이 방은 비밀번호가 걸려 있습니다.
            </p>

            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder="비밀번호"
              aria-label="방 비밀번호"
              maxLength={20}
              className="mb-2 w-full rounded-lg border border-hairline bg-white px-4 py-2.5 text-[17.5px] text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />

            {passwordError && (
              <p className="mb-3 text-[13.5px] font-medium text-crimson-bright">
                {passwordError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasswordPromptRoom(null)}
                className="flex-1 rounded-full border border-hairline bg-white px-5 py-2.5 text-[15px] font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={isJoining}
                className="flex-1 rounded-full bg-gold px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isJoining ? "입장 중..." : "입장"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
