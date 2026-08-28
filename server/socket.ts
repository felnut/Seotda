import { createServer } from "http";
import { Server } from "socket.io";
import { SeotdaGame, STARTING_CHIPS } from "@/lib/seotda/game";
import { getDisplayHandName } from "@/lib/seotda/ranking";
import { ClientGameState } from "@/types/seotda";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { RANKINGS_COLLECTION, RankingEntry } from "@/lib/ranking";
import { PROFILES_COLLECTION, UserProfile } from "@/lib/profile";

const httpServer = createServer();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// CLIENT_URL이 없을 때 "*"(모든 출처 허용)로 폴백하면, 배포 시 이 환경변수를
// 빠뜨려도 아무 사이트에서나 이 서버에 소켓 연결을 열 수 있게 되는 걸 못 알아챌
// 수 있다. 대신 로컬 개발 서버 주소로 폴백해서, 실제 배포 도메인이 이 값과
// 다르면(=CLIENT_URL을 안 챙겼으면) CORS가 곧바로 막혀 눈에 띄게 실패한다.
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
  },
});

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

// 방을 무한정 만들어 서버 메모리(rooms Map)를 소모시키는 걸 막기 위한 상한.
const MAX_ROOMS = 1000;

// 소켓 하나가 짧은 시간에 방을 너무 많이 만드는 것(스팸/DoS)을 막는다.
const ROOM_CREATE_LIMIT = 5;
const ROOM_CREATE_WINDOW_MS = 60_000;

// socketId -> 최근 방 생성 시각 목록 (윈도우 밖으로 밀려난 건 그때그때 걸러낸다)
const roomCreateTimestamps = new Map<string, number[]>();

// 지정한 시간 안에 너무 자주 호출됐으면 true를 반환하고, 아니면 이번 호출을
// 기록한 뒤 false를 반환한다.
function isRateLimited(
  key: string,
  store: Map<string, number[]>,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    store.set(key, recent);
    return true;
  }

  recent.push(now);
  store.set(key, recent);

  return false;
}

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
  // 로그인한 계정과 연결됐다면 Firebase uid, 게스트라면 null
  uid: string | null;
  // 이 방에 처음 입장했을 때의 칩 — 로그인 계정이면 Firestore에 저장된
  // 지속 뱅크롤, 게스트면 STARTING_CHIPS
  startingChips: number;
}

// 로그인 토큰을 검증하고, 계정에 연결된 지속 뱅크롤/닉네임을 조회한다.
// 토큰이 없거나 검증에 실패하면 게스트로 취급해 입장 자체는 막지 않는다.
async function resolveJoiningPlayer(
  idToken: string | undefined,
  requestedName: string | undefined,
): Promise<{ uid: string | null; name: string | null; startingChips: number }> {
  if (!idToken || !adminAuth || !adminDb) {
    return {
      uid: null,
      name: sanitizeName(requestedName),
      startingChips: STARTING_CHIPS,
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const [rankingSnapshot, profileSnapshot] = await Promise.all([
      adminDb.collection(RANKINGS_COLLECTION).doc(uid).get(),
      adminDb.collection(PROFILES_COLLECTION).doc(uid).get(),
    ]);
    const existing = rankingSnapshot.data() as RankingEntry | undefined;
    const profile = profileSnapshot.data() as UserProfile | undefined;

    const name =
      sanitizeName(requestedName) ??
      sanitizeName(profile?.name) ??
      sanitizeName(decoded.name) ??
      sanitizeName(existing?.name);

    return {
      uid,
      name,
      startingChips: existing?.money ?? STARTING_CHIPS,
    };
  } catch (err) {
    console.warn("idToken 검증 실패, 게스트로 진행합니다:", err);
    return {
      uid: null,
      name: sanitizeName(requestedName),
      startingChips: STARTING_CHIPS,
    };
  }
}

// 사용자가 입력한 닉네임을 정리한다. 비어있거나 없으면 null을 반환해
// 호출부에서 기본 이름("플레이어 N")을 쓰도록 한다.
function sanitizeName(name: unknown): string | null {
  if (typeof name !== "string") return null;

  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);

  return trimmed.length > 0 ? trimmed : null;
}

// 이름 뒤에 붙일 주격 조사(이/가)를 받침 유무에 따라 골라 붙인다.
// 한글이 아닌 이름(영문 닉네임 등)은 무난하게 "가"를 붙인다.
function withSubjectParticle(name: string): string {
  const lastChar = name.charCodeAt(name.length - 1);

  if (lastChar >= 0xac00 && lastChar <= 0xd7a3) {
    const hasBatchim = (lastChar - 0xac00) % 28 !== 0;

    return `${name}${hasBatchim ? "이" : "가"}`;
  }

  return `${name}가`;
}

interface Room {
  maxPlayers: number;
  joinedPlayers: JoinedPlayer[];
  game: SeotdaGame | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  // 게임 종료 후 "다시하기"에 동의한 플레이어 id 목록
  restartVotes: Set<string>;
  // 다시하기 전, 파산해서 관전/나가기 결정을 아직 하지 않은 플레이어 id 목록
  pendingBankruptcy: Set<string>;
}

const rooms = new Map<string, Room>();

function createClientGameState(
  game: SeotdaGame,
  playerId: string,
): ClientGameState {
  const state = game.getState();

  // 방을 나간 플레이어는 화면 목록에서 완전히 제외한다.
  const currentPlayerId =
    state.players[state.currentPlayerIndex]?.id ?? null;

  const players = state.players
    .filter((player) => !player.hasLeft)
    .map((player) => {
      const isMe = player.id === playerId;

      const alwaysRevealed =
        isMe || state.phase === "showdown" || state.phase === "finished";

      const cards = player.cards
        ? player.cards.map((card, index) => {
            // reveal 단계에서는 각자 고른 카드를 서버에 먼저 반영해두되,
            // 전원이 다 고르기 전까지는(=phase가 넘어가기 전까지는) 상대에게
            // 보여주지 않는다. 그래야 모두가 버튼을 누른 순간 한꺼번에 공개된다.
            const revealed =
              alwaysRevealed ||
              (state.phase !== "reveal" && index === player.revealedCardIndex);

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
        isSpectator: player.isSpectator,
      };
    });

  return {
    phase: state.phase,

    players,

    // 나간 플레이어가 걸러지며 배열 인덱스가 바뀌었을 수 있으니, id를
    // 기준으로 걸러진 배열에서의 인덱스를 다시 찾는다.
    currentPlayerIndex: players.findIndex((p) => p.id === currentPlayerId),

    pot: state.pot,

    currentBet: state.currentBet,

    winnerId: state.winnerId,

    redealReason: state.redealReason,
    nextAnteMultiplier: state.nextAnteMultiplier,
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
    syncRankingStats(room).catch((err) => {
      console.error("랭킹 동기화 실패:", err);
    });
  }
}

// 판이 끝날 때마다 로그인한(uid가 있는) 참가자의 랭킹 통계를 Firestore에 반영한다.
// 관전자는 그 판에 참여하지 않았으므로 집계에서 제외한다.
async function syncRankingStats(room: Room) {
  if (!room.game || !adminDb) return;

  const db = adminDb;
  const gamePlayers = room.game.getState().players;
  const winnerId = room.game.getState().winnerId;

  const linkedPlayers = room.joinedPlayers.filter((p) => p.uid);

  await Promise.all(
    linkedPlayers.map(async (joined) => {
      const gamePlayer = gamePlayers.find((p) => p.id === joined.id);

      if (!gamePlayer || gamePlayer.isSpectator) return;

      const uid = joined.uid as string;
      const docRef = db.collection(RANKINGS_COLLECTION).doc(uid);

      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(docRef);
        const existing = snapshot.data() as RankingEntry | undefined;

        const wins =
          (existing?.wins ?? 0) + (gamePlayer.id === winnerId ? 1 : 0);
        const gamesPlayed = (existing?.gamesPlayed ?? 0) + 1;

        const entry: RankingEntry = {
          name: joined.name,
          money: gamePlayer.chips,
          peakChips: Math.max(existing?.peakChips ?? 0, gamePlayer.chips),
          wins,
          gamesPlayed,
          winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
          updatedAt: Date.now(),
        };

        tx.set(docRef, entry);
      });
    }),
  );
}

// 대기실 등에서 참가자 이름을 보여주기 위한 목록
function roomPlayersPayload(room: Room) {
  return room.joinedPlayers.map((player) => ({
    id: player.id,
    name: player.name,
  }));
}

function broadcastPlayersUpdated(roomId: string, room: Room) {
  io.to(roomId).emit("players-updated", {
    count: room.joinedPlayers.length,
    maxPlayers: room.maxPlayers,
    players: roomPlayersPayload(room),
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

// 현재 관전/나가기 결정을 기다리고 있는 파산 플레이어 정보를 만든다.
function bankruptcyNoticePayload(room: Room) {
  const playerIds = Array.from(room.pendingBankruptcy);

  const playerNames = room.joinedPlayers
    .filter((player) => room.pendingBankruptcy.has(player.id))
    .map((player) => player.name);

  return { playerIds, playerNames };
}

function broadcastBankruptcyNotice(room: Room) {
  const payload = bankruptcyNoticePayload(room);

  for (const player of room.joinedPlayers) {
    if (!player.socketId) continue;

    io.to(player.socketId).emit("bankruptcy-notice", payload);
  }
}

// 모든 참가자가 다시하기에 동의했으면 파산자 유무를 확인한 뒤 새 판을 시작한다.
function tryStartVotedRestart(room: Room) {
  if (!room.game || room.game.getState().phase !== "finished") return;

  // 이미 파산자의 관전/나가기 결정을 기다리는 중이라면 새로 시작하지 않는다.
  if (room.pendingBankruptcy.size > 0) return;

  if (
    room.restartVotes.size > 0 &&
    room.restartVotes.size >= room.joinedPlayers.length &&
    room.joinedPlayers.length >= MIN_PLAYERS
  ) {
    room.restartVotes.clear();
    beginRestart(room);
  } else {
    broadcastRestartVotes(room);
  }
}

// 다시하기가 확정된 뒤 실제로 새 판을 시작한다. 파산한 플레이어가 있다면
// 먼저 전원에게 한 번 알리고, 그 플레이어들이 관전/나가기를 고를 때까지 기다린다.
function beginRestart(room: Room) {
  if (!room.game) return;

  const bankruptPlayers = room.game
    .getState()
    .players.filter((player) => player.chips === 0 && !player.isSpectator);

  if (bankruptPlayers.length > 0) {
    room.pendingBankruptcy = new Set(
      bankruptPlayers.map((player) => player.id),
    );
    broadcastBankruptcyNotice(room);
    return;
  }

  // 칩은 초기화하지 않고 그대로 이어서 시작한다.
  room.game.start(false);
  broadcastGameState(room);
}

// 파산자 전원이 관전/나가기를 결정하면 이어서 새 판을 시작한다.
function resumeRestartAfterBankruptcy(room: Room) {
  if (room.pendingBankruptcy.size > 0 || !room.game) return;

  const playableCount = room.game
    .getState()
    .players.filter((player) => !player.isSpectator).length;

  if (playableCount < MIN_PLAYERS) {
    for (const player of room.joinedPlayers) {
      if (!player.socketId) continue;

      io.to(player.socketId).emit("error-message", {
        message: "게임을 계속할 인원이 부족합니다.",
      });
    }

    return;
  }

  room.game.start(false);
  broadcastGameState(room);
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

  const leavingPlayer = room.joinedPlayers.find((p) => p.id === playerId);

  room.joinedPlayers = room.joinedPlayers.filter((p) => p.id !== playerId);
  room.restartVotes.delete(playerId);

  const wasPendingBankruptcy = room.pendingBankruptcy.delete(playerId);

  if (room.game) {
    try {
      // 진행 중인 판이라면 다이로 처리해 판돈을 잃게 하고, 이후 판부터는
      // 완전히 제외한다(관전자로도 남지 않고 화면에서도 사라진다).
      room.game.leaveGame(playerId);
    } catch {
      // 이미 게임에 없는 플레이어 등 예외 상황은 무시한다.
    }
  }

  if (room.joinedPlayers.length === 0) {
    rooms.delete(roomId);
    return;
  }

  if (leavingPlayer) {
    io.to(roomId).emit("player-left", {
      message: `${withSubjectParticle(leavingPlayer.name)} 나갔습니다.`,
    });
  }

  broadcastPlayersUpdated(roomId, room);

  if (room.game) {
    broadcastGameState(room);
  }

  if (wasPendingBankruptcy) {
    resumeRestartAfterBankruptcy(room);
  } else {
    // 남은 인원만으로 이미 만장일치라면(예: 미투표자가 방을 나간 경우) 바로 재시작
    tryStartVotedRestart(room);
  }
}

function createRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("연결:", socket.id);

  socket.on(
    "create-room",
    async ({
      maxPlayers,
      name,
      idToken,
    }: {
      maxPlayers: number;
      name?: string;
      idToken?: string;
    }) => {
      if (rooms.size >= MAX_ROOMS) {
        socket.emit("error-message", {
          message: "서버에 방이 가득 찼습니다. 잠시 후 다시 시도해주세요.",
        });

        return;
      }

      if (
        isRateLimited(
          socket.id,
          roomCreateTimestamps,
          ROOM_CREATE_LIMIT,
          ROOM_CREATE_WINDOW_MS,
        )
      ) {
        socket.emit("error-message", {
          message: "방 만들기를 너무 자주 시도했습니다. 잠시 후 다시 시도해주세요.",
        });

        return;
      }

      const roomId = createRoomId();

      const safeMaxPlayers = Number.isInteger(maxPlayers)
        ? Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers))
        : MIN_PLAYERS;

      const resolved = await resolveJoiningPlayer(idToken, name);

      const room: Room = {
        maxPlayers: safeMaxPlayers,
        joinedPlayers: [
          {
            id: "player-1",
            name: resolved.name ?? "플레이어 1",
            socketId: socket.id,
            uid: resolved.uid,
            startingChips: resolved.startingChips,
          },
        ],
        game: null,
        disconnectTimers: new Map(),
        restartVotes: new Set(),
        pendingBankruptcy: new Set(),
      };

      rooms.set(roomId, room);

      socket.join(roomId);

      socket.emit("room-created", {
        roomId,
        playerId: "player-1",
        playerCount: room.joinedPlayers.length,
        maxPlayers: room.maxPlayers,
        players: roomPlayersPayload(room),
      });
    },
  );

  socket.on(
    "join-room",
    async ({
      roomId,
      name,
      idToken,
    }: {
      roomId: string;
      name?: string;
      idToken?: string;
    }) => {
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
      const resolved = await resolveJoiningPlayer(idToken, name);
      const resolvedName = resolved.name ?? `플레이어 ${playerIndex}`;

      if (room.joinedPlayers.some((p) => p.name === resolvedName)) {
        socket.emit("error-message", {
          message: "이미 같은 이름의 참가자가 있습니다.",
        });

        return;
      }

      room.joinedPlayers.push({
        id: playerId,
        name: resolvedName,
        socketId: socket.id,
        uid: resolved.uid,
        startingChips: resolved.startingChips,
      });

      socket.join(roomId);

      socket.emit("room-joined", {
        roomId,
        playerId,
        playerCount: room.joinedPlayers.length,
        maxPlayers: room.maxPlayers,
        players: roomPlayersPayload(room),
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
        players: roomPlayersPayload(room),
      });

      broadcastPlayersUpdated(roomId, room);

      if (room.game) {
        socket.emit("game-state", createClientGameState(room.game, playerId));
      }

      if (room.pendingBankruptcy.size > 0) {
        socket.emit("bankruptcy-notice", bankruptcyNoticePayload(room));
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
      const players = room.joinedPlayers.map((player) => ({
        name: player.name,
        chips: player.startingChips,
      }));

      room.game = new SeotdaGame(players);
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

  // 파산한 플레이어가 다음 판을 관전할지, 방을 나갈지 결정한다.
  socket.on(
    "bankruptcy-decision",
    ({ roomId, choice }: { roomId: string; choice: "spectate" | "leave" }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId || !room.pendingBankruptcy.has(playerId)) return;

      room.pendingBankruptcy.delete(playerId);

      try {
        room.game.setSpectator(playerId);
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error
              ? error.message
              : "관전 처리에 실패했습니다.",
        });
      }

      if (choice === "leave") {
        socket.leave(roomId);
        removePlayerFromRoom(roomId, room, playerId);
      }

      resumeRestartAfterBankruptcy(room);
    },
  );

  socket.on(
    "bet",
    ({
      roomId,
      amount,
      isHalf,
    }: {
      roomId: string;
      amount: number;
      isHalf?: boolean;
    }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      try {
        room.game.bet(playerId, amount, isHalf);

        broadcastGameState(room);
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error ? error.message : "베팅에 실패했습니다.",
        });
      }
    },
  );

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

    roomCreateTimestamps.delete(socket.id);

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
