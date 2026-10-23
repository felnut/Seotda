"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoomInfo, RoomListEntry } from "@/types/seotda";
import { socket } from "@/lib/socket";
import { saveSession } from "@/lib/session";
import { loadNickname } from "@/lib/nickname";
import { useAuth } from "@/lib/useAuth";
import { Modal } from "../components/Modal";

type Filter = "all" | "waiting" | "playing";
export function RoomsPageClient({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const user = useAuth();
  const [rooms, setRooms] = useState<RoomListEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [connected, setConnected] = useState(false);
  const [invitedId, setInvitedId] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<RoomListEntry | null>(null);
  const [password, setPassword] = useState("");
  const cleanupJoin = useRef<(() => void) | null>(null);
  const joining = useRef(false);

  useEffect(() => {
    const refresh = () => socket.emit("list-rooms");
    const receive = (list: RoomListEntry[]) => {
      setRooms(list);
      setConnected(true);
      setInvitedId(
        new URLSearchParams(window.location.search).get("room") ?? "",
      );
    };
    const disconnect = () => setConnected(false);
    socket.on("rooms-list", receive);
    socket.on("connect", refresh);
    socket.on("disconnect", disconnect);
    refresh();
    const interval = window.setInterval(refresh, 4000);
    return () => {
      clearInterval(interval);
      socket.off("rooms-list", receive);
      socket.off("connect", refresh);
      socket.off("disconnect", disconnect);
      cleanupJoin.current?.();
    };
  }, []);

  const join = async (room: RoomListEntry, roomPassword?: string) => {
    if (joining.current) return;
    joining.current = true;
    setIsJoining(true);
    setError("");
    try {
      const idToken = user ? await user.getIdToken() : undefined;
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("room-joined", joined);
        socket.off("error-message", failed);
        joining.current = false;
        cleanupJoin.current = null;
      };
      const joined = (info: RoomInfo) => {
        cleanup();
        setIsJoining(false);
        setPasswordRoom(null);
        saveSession({
          roomId: info.roomId,
          playerId: info.playerId,
          rejoinToken: info.rejoinToken,
        });
        if (!embedded) router.push("/");
      };
      const failed = ({ message }: { message: string }) => {
        cleanup();
        setError(message);
        setIsJoining(false);
      };
      const timer = setTimeout(
        () =>
          failed({
            message:
              "서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.",
          }),
        10000,
      );
      cleanupJoin.current = cleanup;
      socket.on("room-joined", joined);
      socket.on("error-message", failed);
      socket.emit("join-room", {
        roomId: room.roomId,
        name: loadNickname().trim() || undefined,
        password: roomPassword?.trim() || undefined,
        idToken,
      });
    } catch {
      joining.current = false;
      setIsJoining(false);
      setError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
    }
  };
  const choose = (room: RoomListEntry) => {
    setError("");
    if (room.hasPassword) {
      setPasswordRoom(room);
      setPassword("");
    } else void join(room);
  };
  const filtered = rooms.filter(
    (room) =>
      filter === "all" ||
      (filter === "playing" ? room.inProgress : !room.inProgress),
  );
  const Wrapper = embedded ? "section" : "main";
  return (
    <Wrapper
      className={embedded ? "room-list" : "rooms-page"}
      aria-labelledby="rooms-title"
    >
      <h2 id="rooms-title" className="section-title">
        함께할 테이블
      </h2>
      {invitedId && (
        <p className="invite-notice">
          {rooms.some((room) => room.roomId === invitedId)
            ? "초대받은 방을 아래에서 선택해 주세요."
            : "초대받은 방이 종료되었거나 목록을 확인 중입니다."}
        </p>
      )}
      <div className="room-filters" aria-label="방 목록 필터">
        {(
          [
            ["all", "전체"],
            ["waiting", "대기 중"],
            ["playing", "진행 중"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="room-rows">
        {filtered.map((room) => (
          <li key={room.roomId} data-invited={room.roomId === invitedId}>
            <h3>
              {room.name}
              {room.roomId === invitedId && <small>초대받은 방</small>}
            </h3>
            <p className="room-meta">
              <span
                className={
                  room.inProgress ? "status-playing" : "status-waiting"
                }
              >
                {room.inProgress ? "진행 중" : "대기 중"}
              </span>
              <span>
                {room.playerCount}/{room.maxPlayers}
              </span>
              <span>{room.hasPassword ? "비밀번호" : "공개"}</span>
            </p>
            <button
              className={`paper-button ${room.inProgress ? "" : "primary"}`}
              disabled={isJoining || room.playerCount >= room.maxPlayers}
              onClick={() => choose(room)}
            >
              {room.playerCount >= room.maxPlayers
                ? "가득 참"
                : room.inProgress
                  ? "관전하기"
                  : "참가하기"}
              <span aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <div className="rooms-empty">
          <p>
            {!connected
              ? "테이블을 불러오고 있어요."
              : filter === "all"
                ? "아직 열린 테이블이 없어요."
                : "이 조건에 맞는 테이블이 없어요."}
          </p>
          <span>
            {connected
              ? "새 방을 만들거나 AI와 먼저 한 판 즐겨보세요."
              : "게임 서버 연결을 확인하고 있습니다."}
          </span>
        </div>
      )}
      {error && !passwordRoom && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!embedded && (
        <Link className="paper-button primary" href="/#create-room">
          새 방 만들기 →
        </Link>
      )}
      {passwordRoom && (
        <Modal titleId="password-title" onClose={() => setPasswordRoom(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void join(passwordRoom, password);
            }}
          >
            <h2 id="password-title">{passwordRoom.name}</h2>
            <p>비밀번호가 있는 방입니다.</p>
            <label htmlFor="room-password">비밀번호</label>
            <input
              id="room-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={20}
              autoFocus
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="paper-button primary" disabled={isJoining}>
              {isJoining ? "입장 중…" : "입장하기 →"}
            </button>
          </form>
        </Modal>
      )}
    </Wrapper>
  );
}
