"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoomInfo, RoomListEntry } from "@/types/seotda";
import { socket } from "@/lib/socket";
import { saveSession } from "@/lib/session";
import { loadNickname } from "@/lib/nickname";
import { useAuth } from "@/lib/useAuth";

export default function RoomsPage() {
  const router = useRouter();
  const user = useAuth();

  const [roomList, setRoomList] = useState<RoomListEntry[]>([]);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

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
    socket.on("rooms-list", (list: RoomListEntry[]) => {
      setRoomList(list);
    });

    return () => {
      socket.off("rooms-list");
    };
  }, []);

  const joinRoom = async (roomId: string, password?: string) => {
    if (isJoining) return;

    setIsJoining(true);
    setError("");
    setPasswordError("");

    const idToken = user ? await user.getIdToken() : undefined;

    const handleJoined = (info: RoomInfo) => {
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

    const cleanup = () => {
      socket.off("room-joined", handleJoined);
      socket.off("error-message", handleError);
    };

    socket.on("room-joined", handleJoined);
    socket.on("error-message", handleError);

    socket.emit("join-room", {
      roomId,
      name: loadNickname().trim() || undefined,
      password: password?.trim() || undefined,
      idToken,
    });
  };

  const handleRoomClick = (room: RoomListEntry) => {
    if (room.hasPassword) {
      setPasswordPromptRoom(room);
      setPasswordInput("");
      setPasswordError("");
      return;
    }

    joinRoom(room.roomId);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="mb-6 inline-block w-fit text-[13.5px] text-zinc-500 hover:text-zinc-300"
      >
        ← 돌아가기
      </Link>

      <h1 className="mb-1 text-[32px] font-black tracking-tight text-gold">
        방 찾기
      </h1>

      <div className="flex min-h-64 flex-col gap-2 rounded-2xl border border-white/10 bg-white/3 p-3 shadow-xl shadow-black/30">
        {roomList.length === 0 && (
          <p className="flex flex-1 items-center justify-center py-12 text-center text-[15px] text-zinc-500">
            참가할 수 있는 방이 없습니다. 새 방을 만들어보세요.
          </p>
        )}

        {roomList.map((room) => (
          <button
            key={room.roomId}
            type="button"
            onClick={() => handleRoomClick(room)}
            disabled={isJoining}
            className="animate-fade-up flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3.5 text-left transition hover:scale-[1.01] hover:border-gold/40 hover:bg-gold/8 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="truncate text-[17px] font-semibold text-zinc-100">
              {room.hasPassword ? "🔒 " : ""}
              {room.name}
            </span>

            <span className="shrink-0 font-mono text-[15px] tabular-nums text-zinc-500">
              {room.playerCount}/{room.maxPlayers}명
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="animate-fade-up mt-6 rounded-xl border border-crimson/30 bg-crimson/10 p-4 text-center text-[17.5px] font-medium text-crimson-bright">
          {error}
        </p>
      )}

      <Link
        href="/"
        className="mt-8 w-full rounded-xl bg-gold px-6 py-3.5 text-center text-[17.5px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98]"
      >
        새 방 만들기
      </Link>

      {passwordPromptRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPasswordPromptRoom(null)}
        >
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom(passwordPromptRoom.roomId, passwordInput);
            }}
            className="animate-pop-in w-full max-w-xs rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
          >
            <h2 className="mb-1 text-[19px] font-bold">
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
              maxLength={20}
              className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
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
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-[15px] font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={isJoining}
                className="flex-1 rounded-xl bg-gold px-5 py-2.5 text-[15px] font-semibold text-zinc-900 transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
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
