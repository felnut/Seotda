import { createServer } from "http";
import { Server } from "socket.io";
import { SeotdaGame } from "@/lib/seotda/game";
import { ClientGameState } from "@/types/seotda";

const httpServer = createServer();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_URL = process.env.CLIENT_URL ?? "*";

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
  },
});

interface Room {
  game: SeotdaGame;
  players: Map<string, string>;
}

const rooms = new Map<string, Room>();

function createClientGameState(
  game: SeotdaGame,
  playerId: string,
): ClientGameState {
  const state = game.getState();

  console.log(`[상태 전송] playerId=${playerId}`);

  return {
    phase: state.phase,

    players: state.players.map((player) => {
      const isMe = player.id === playerId;

      console.log(
        `  ${player.id}: 자기 자신=${isMe}, 카드=${player.cards?.length ?? 0}`,
      );

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

      const handResult =
        isMe && player.cards ? game.getHandResult(player.id) : null;

      return {
        id: player.id,
        name: player.name,
        cards,
        handName: handResult?.name ?? null,
        revealedCardIndex: player.revealedCardIndex,
        selectedIndices: alwaysRevealed ? player.selectedIndices : null,
        hasSelectedHand: player.selectedIndices !== null,
        status: player.status,
        chips: player.chips,
        bet: player.bet,
      };
    }),

    currentPlayerIndex: state.currentPlayerIndex,

    pot: state.pot,

    currentBet: state.currentBet,

    winnerId: state.winnerId,
  };
}

function broadcastGameState(roomId: string, room: Room) {
  for (const [socketId, playerId] of room.players) {
    const state = createClientGameState(room.game, playerId);

    io.to(socketId).emit("game-state", state);
  }
}

function createRoom(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("연결:", socket.id);

  socket.on("create-room", () => {
    const roomId = createRoom();

    const game = new SeotdaGame(["플레이어 1", "플레이어 2"]);

    rooms.set(roomId, {
      game,
      players: new Map(),
    });

    const room = rooms.get(roomId)!;

    room.players.set(socket.id, "player-1");

    socket.join(roomId);

    socket.emit("room-created", {
      roomId,
      playerId: "player-1",
    });
  });

  socket.on("join-room", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error-message", {
        message: "존재하지 않는 방입니다.",
      });

      return;
    }

    if (room.players.size >= 2) {
      socket.emit("error-message", {
        message: "방이 가득 찼습니다.",
      });

      return;
    }

    room.players.set(socket.id, "player-2");

    socket.join(roomId);

    socket.emit("room-joined", {
      roomId,
      playerId: "player-2",
    });

    io.to(roomId).emit("players-updated", {
      count: room.players.size,
    });
  });

  socket.on("start-game", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) return;

    if (room.players.size !== 2) {
      socket.emit("error-message", {
        message: "플레이어 2명이 필요합니다.",
      });

      return;
    }
    room.game.start();
    broadcastGameState(roomId, room);
  });

  socket.on("restart-game", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error-message", {
        message: "존재하지 않는 방입니다.",
      });
      return;
    }

    if (room.players.size !== 2) {
      socket.emit("error-message", {
        message: "플레이어 2명이 필요합니다.",
      });
      return;
    }

    if (room.game.getState().phase !== "finished") {
      socket.emit("error-message", {
        message: "현재 게임을 다시 시작할 수 없습니다.",
      });
      return;
    }

    try {
      room.game.start();

      broadcastGameState(roomId, room);
    } catch (error) {
      socket.emit("error-message", {
        message:
          error instanceof Error
            ? error.message
            : "게임을 다시 시작할 수 없습니다.",
      });
    }
  });

  socket.on("bet", ({ roomId, amount }: { roomId: string; amount: number }) => {
    console.log("[SOCKET BET]", {
      socketId: socket.id,
      roomId,
      amount,
    });

    const room = rooms.get(roomId);

    if (!room) {
      console.log("[BET ERROR] 방 없음");
      return;
    }

    const playerId = room.players.get(socket.id);

    if (!playerId) {
      console.log("[BET ERROR] 플레이어 없음");
      return;
    }

    try {
      room.game.bet(playerId, amount);

      console.log("[BET STATE]", room.game.getState());

      broadcastGameState(roomId, room);
    } catch (error) {
      console.error("[BET ERROR]", error);

      socket.emit("error-message", {
        message:
          error instanceof Error ? error.message : "베팅에 실패했습니다.",
      });
    }
  });

  socket.on("call", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const playerId = room.players.get(socket.id);

    if (!playerId) return;

    try {
      room.game.call(playerId);

      broadcastGameState(roomId, room);
    } catch (error) {
      socket.emit("error-message", {
        message: error instanceof Error ? error.message : "콜에 실패했습니다.",
      });
    }
  });

  socket.on("check", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const playerId = room.players.get(socket.id);

    if (!playerId) return;

    try {
      room.game.check(playerId);

      broadcastGameState(roomId, room);
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

      if (!room) return;

      const playerId = room.players.get(socket.id);

      if (!playerId) return;

      try {
        room.game.raise(playerId, amount);

        broadcastGameState(roomId, room);
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

      if (!room) return;

      const playerId = room.players.get(socket.id);

      if (!playerId) return;

      try {
        room.game.revealCard(playerId, cardIndex);

        broadcastGameState(roomId, room);
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

      if (!room) return;

      const playerId = room.players.get(socket.id);

      if (!playerId) return;

      try {
        room.game.selectHand(playerId, indices);

        broadcastGameState(roomId, room);
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

    if (!room) return;

    const playerId = room.players.get(socket.id);

    if (!playerId) return;

    try {
      room.game.fold(playerId);

      broadcastGameState(roomId, room);
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

    if (room.players.has(socket.id)) {
      room.players.delete(socket.id);

      socket.leave(roomId);

      io.to(roomId).emit("players-updated", {
        count: room.players.size,
      });

      if (room.players.size === 0) {
        rooms.delete(roomId);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("연결 종료:", socket.id);

    for (const [roomId, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);

        io.to(roomId).emit("players-updated", {
          count: room.players.size,
        });

        if (room.players.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
