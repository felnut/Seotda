import { createServer } from "http";
import { Server } from "socket.io";
import { SeotdaGame } from "@/lib/seotda/game";
import { getDisplayHandName } from "@/lib/seotda/ranking";
import { ClientGameState } from "@/types/seotda";

const httpServer = createServer();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_URL = process.env.CLIENT_URL ?? "*";

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
  },
});

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

// 새로고침 등으로 끊긴 소켓이 재접속할 때까지 자리를 비워두는 유예 시간
const DISCONNECT_GRACE_MS = 30_000;

// 구사류로 재경기가 확정된 뒤, 화면에 사유를 보여주고 다시 시작하기까지의 대기 시간
const REDEAL_DELAY_MS = 2_500;

const MAX_NAME_LENGTH = 8;

interface JoinedPlayer {
  id: string;
  name: string;
  // 접속이 끊긴 동안에는 null (유예 시간 내 재접속 대기 중)
  socketId: string | null;
}

// 사용자가 입력한 닉네임을 정리한다. 비어있거나 없으면 null을 반환해
// 호출부에서 기본 이름("플레이어 N")을 쓰도록 한다.
function sanitizeName(name: unknown): string | null {
  if (typeof name !== "string") return null;

  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);

  return trimmed.length > 0 ? trimmed : null;
}

interface Room {
  maxPlayers: number;
  joinedPlayers: JoinedPlayer[];
  game: SeotdaGame | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  // 게임 종료 후 "다시하기"에 동의한 플레이어 id 목록
  restartVotes: Set<string>;
}

const rooms = new Map<string, Room>();

function createClientGameState(
  game: SeotdaGame,
  playerId: string,
): ClientGameState {
  const state = game.getState();

  return {
    phase: state.phase,

    players: state.players.map((player) => {
      const isMe = player.id === playerId;

      const alwaysRevealed =
        isMe || state.phase === "showdown" || state.phase === "finished";

      const cards = player.cards
        ? player.cards.map((card, index) => {
            const revealed =
              alwaysRevealed || index === player.revealedCardIndex;

            return {
              id: card.id,
              revealed,
              card: revealed ? card : undefined,
            };
          })
        : [];

      // 본인 족보는 항상, 상대 족보는 쇼다운/종료 후 카드가 공개될 때만 알려준다.
      const handResult =
        player.cards && (isMe || alwaysRevealed)
          ? game.getHandResult(player.id)
          : null;

      return {
        id: player.id,
        name: player.name,
        cards,
        handName: handResult ? getDisplayHandName(handResult) : null,
        revealedCardIndex: player.revealedCardIndex,
        selectedIndices: alwaysRevealed ? player.selectedIndices : null,
        hasSelectedHand: player.selectedIndices !== null,
        status: player.status,
        chips: player.chips,
        bet: player.bet,
        lastAction: player.lastAction,
      };
    }),

    currentPlayerIndex: state.currentPlayerIndex,

    pot: state.pot,

    currentBet: state.currentBet,

    winnerId: state.winnerId,

    redealReason: state.redealReason,
  };
}

function broadcastGameState(room: Room) {
  if (!room.game) return;

  for (const player of room.joinedPlayers) {
    if (!player.socketId) continue;

    const state = createClientGameState(room.game, player.id);

    io.to(player.socketId).emit("game-state", state);
  }

  if (room.game.getState().phase === "finished") {
    broadcastRestartVotes(room);
  }
}

function broadcastPlayersUpdated(roomId: string, room: Room) {
  io.to(roomId).emit("players-updated", {
    count: room.joinedPlayers.length,
    maxPlayers: room.maxPlayers,
  });
}

function broadcastRestartVotes(room: Room) {
  const payload = {
    votes: room.restartVotes.size,
    total: room.joinedPlayers.length,
    votedPlayerIds: Array.from(room.restartVotes),
  };

  for (const player of room.joinedPlayers) {
    if (!player.socketId) continue;

    io.to(player.socketId).emit("restart-votes-updated", payload);
  }
}

// 모든 참가자가 다시하기에 동의했으면 새 판을 시작한다.
function tryStartVotedRestart(room: Room) {
  if (!room.game || room.game.getState().phase !== "finished") return;

  if (
    room.restartVotes.size > 0 &&
    room.restartVotes.size >= room.joinedPlayers.length &&
    room.joinedPlayers.length >= MIN_PLAYERS
  ) {
    room.restartVotes.clear();
    room.game.start(true);
    broadcastGameState(room);
  } else {
    broadcastRestartVotes(room);
  }
}

function findPlayerIdBySocket(room: Room, socketId: string): string | null {
  return room.joinedPlayers.find((p) => p.socketId === socketId)?.id ?? null;
}

function clearDisconnectTimer(room: Room, playerId: string) {
  const timer = room.disconnectTimers.get(playerId);

  if (timer) {
    clearTimeout(timer);
    room.disconnectTimers.delete(playerId);
  }
}

function removePlayerFromRoom(roomId: string, room: Room, playerId: string) {
  clearDisconnectTimer(room, playerId);

  room.joinedPlayers = room.joinedPlayers.filter((p) => p.id !== playerId);
  room.restartVotes.delete(playerId);

  if (room.joinedPlayers.length === 0) {
    rooms.delete(roomId);
    return;
  }

  broadcastPlayersUpdated(roomId, room);

  // 남은 인원만으로 이미 만장일치라면(예: 미투표자가 방을 나간 경우) 바로 재시작
  tryStartVotedRestart(room);
}

function createRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("연결:", socket.id);

  socket.on(
    "create-room",
    ({ maxPlayers, name }: { maxPlayers: number; name?: string }) => {
      const roomId = createRoomId();

      const safeMaxPlayers = Number.isInteger(maxPlayers)
        ? Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers))
        : MIN_PLAYERS;

      const room: Room = {
        maxPlayers: safeMaxPlayers,
        joinedPlayers: [
          {
            id: "player-1",
            name: sanitizeName(name) ?? "플레이어 1",
            socketId: socket.id,
          },
        ],
        game: null,
        disconnectTimers: new Map(),
        restartVotes: new Set(),
      };

      rooms.set(roomId, room);

      socket.join(roomId);

      socket.emit("room-created", {
        roomId,
        playerId: "player-1",
        playerCount: room.joinedPlayers.length,
        maxPlayers: room.maxPlayers,
      });
    },
  );

  socket.on(
    "join-room",
    ({ roomId, name }: { roomId: string; name?: string }) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error-message", {
          message: "존재하지 않는 방입니다.",
        });

        return;
      }

      if (room.game) {
        socket.emit("error-message", {
          message: "이미 게임이 시작된 방입니다.",
        });

        return;
      }

      if (room.joinedPlayers.length >= room.maxPlayers) {
        socket.emit("error-message", {
          message: "방이 가득 찼습니다.",
        });

        return;
      }

      const playerIndex = room.joinedPlayers.length + 1;
      const playerId = `player-${playerIndex}`;

      room.joinedPlayers.push({
        id: playerId,
        name: sanitizeName(name) ?? `플레이어 ${playerIndex}`,
        socketId: socket.id,
      });

      socket.join(roomId);

      socket.emit("room-joined", {
        roomId,
        playerId,
        playerCount: room.joinedPlayers.length,
        maxPlayers: room.maxPlayers,
      });

      broadcastPlayersUpdated(roomId, room);
    },
  );

  // 새로고침 등으로 끊겼던 세션을 복구합니다.
  socket.on(
    "rejoin-room",
    ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      const room = rooms.get(roomId);

      const joined = room?.joinedPlayers.find((p) => p.id === playerId);

      if (!room || !joined) {
        socket.emit("rejoin-failed");
        return;
      }

      clearDisconnectTimer(room, playerId);

      joined.socketId = socket.id;

      socket.join(roomId);

      socket.emit("room-joined", {
        roomId,
        playerId,
        playerCount: room.joinedPlayers.length,
        maxPlayers: room.maxPlayers,
      });

      broadcastPlayersUpdated(roomId, room);

      if (room.game) {
        socket.emit("game-state", createClientGameState(room.game, playerId));
      }
    },
  );

  socket.on("start-game", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) return;

    if (room.joinedPlayers.length < MIN_PLAYERS) {
      socket.emit("error-message", {
        message: `최소 ${MIN_PLAYERS}명이 필요합니다.`,
      });

      return;
    }

    if (!room.game) {
      const names = room.joinedPlayers.map((player) => player.name);

      room.game = new SeotdaGame(names);
    }

    room.game.start();
    broadcastGameState(room);
  });

  // "다시하기"는 즉시 재시작이 아니라 투표다 — 참가자 전원이 동의해야 시작된다.
  socket.on("restart-game", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error-message", {
        message: "존재하지 않는 방입니다.",
      });
      return;
    }

    if (!room.game) {
      socket.emit("error-message", {
        message: "아직 시작되지 않은 게임입니다.",
      });
      return;
    }

    if (room.game.getState().phase !== "finished") {
      socket.emit("error-message", {
        message: "현재 게임을 다시 시작할 수 없습니다.",
      });
      return;
    }

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    room.restartVotes.add(playerId);

    tryStartVotedRestart(room);
  });

  socket.on("bet", ({ roomId, amount }: { roomId: string; amount: number }) => {
    const room = rooms.get(roomId);

    if (!room || !room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    try {
      room.game.bet(playerId, amount);

      broadcastGameState(room);
    } catch (error) {
      socket.emit("error-message", {
        message:
          error instanceof Error ? error.message : "베팅에 실패했습니다.",
      });
    }
  });

  socket.on("call", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room || !room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    try {
      room.game.call(playerId);

      broadcastGameState(room);
    } catch (error) {
      socket.emit("error-message", {
        message: error instanceof Error ? error.message : "콜에 실패했습니다.",
      });
    }
  });

  socket.on("check", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room || !room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    try {
      room.game.check(playerId);

      broadcastGameState(room);
    } catch (error) {
      socket.emit("error-message", {
        message:
          error instanceof Error ? error.message : "체크에 실패했습니다.",
      });
    }
  });

  socket.on(
    "raise",
    ({ roomId, amount }: { roomId: string; amount: number }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      try {
        room.game.raise(playerId, amount);

        broadcastGameState(room);
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error ? error.message : "레이즈에 실패했습니다.",
        });
      }
    },
  );

  socket.on(
    "reveal-card",
    ({ roomId, cardIndex }: { roomId: string; cardIndex: number }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      try {
        room.game.revealCard(playerId, cardIndex);

        broadcastGameState(room);
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error
              ? error.message
              : "카드 공개에 실패했습니다.",
        });
      }
    },
  );

  socket.on(
    "select-hand",
    ({ roomId, indices }: { roomId: string; indices: [number, number] }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      try {
        room.game.selectHand(playerId, indices);

        broadcastGameState(room);

        if (room.game.getState().phase === "redeal") {
          setTimeout(() => {
            if (!room.game || room.game.getState().phase !== "redeal") return;

            room.game.start();
            broadcastGameState(room);
          }, REDEAL_DELAY_MS);
        }
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error
              ? error.message
              : "족보 선택에 실패했습니다.",
        });
      }
    },
  );

  socket.on("fold", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room || !room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    try {
      room.game.fold(playerId);

      broadcastGameState(room);
    } catch (error) {
      socket.emit("error-message", {
        message:
          error instanceof Error ? error.message : "다이에 실패했습니다.",
      });
    }
  });

  socket.on("leave-room", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    socket.leave(roomId);

    removePlayerFromRoom(roomId, room, playerId);
  });

  socket.on("disconnect", () => {
    console.log("연결 종료:", socket.id);

    for (const [roomId, room] of rooms) {
      const joined = room.joinedPlayers.find((p) => p.socketId === socket.id);

      if (!joined) continue;

      // 바로 제거하지 않고, 새로고침 등으로 재접속할 시간을 준다.
      joined.socketId = null;

      const timer = setTimeout(() => {
        room.disconnectTimers.delete(joined.id);
        removePlayerFromRoom(roomId, room, joined.id);
      }, DISCONNECT_GRACE_MS);

      room.disconnectTimers.set(joined.id, timer);

      break;
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
