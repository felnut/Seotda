import { createServer } from "http";
import { randomUUID, timingSafeEqual } from "crypto";
import { Server } from "socket.io";
import { SeotdaGame, STARTING_CHIPS } from "@/lib/seotda/game";
import { RaiseRatio } from "@/lib/seotda/bettingRound";
import { getDisplayHandName } from "@/lib/seotda/ranking";
import { ChatMessage, ClientGameState, RoomListEntry } from "@/types/seotda";
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

// 채팅 도배 방지
const CHAT_MESSAGE_LIMIT = 10;
const CHAT_MESSAGE_WINDOW_MS = 10_000;
const chatMessageTimestamps = new Map<string, number[]>();

// "입력 중" 신호는 저장하지 않는 순간적인 알림이라 메시지보다 여유 있게 허용한다.
const CHAT_TYPING_LIMIT = 20;
const CHAT_TYPING_WINDOW_MS = 10_000;
const chatTypingTimestamps = new Map<string, number[]>();

// 방마다 보관하는 채팅 히스토리 최대 개수 — 넘으면 오래된 것부터 버린다.
const MAX_CHAT_HISTORY = 50;

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

// 쇼다운에서 재경기가 결정됐을 때, 공개된 패를 보여준 뒤 즉시 재대결로
// 넘어가기까지의 대기 시간
const SHOWDOWN_REVEAL_PAUSE_MS = 2_500;

const MAX_NAME_LENGTH = 13;
const MAX_ROOM_NAME_LENGTH = 20;
const MAX_ROOM_PASSWORD_LENGTH = 20;
const MAX_CHAT_LENGTH = 200;

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
  // rejoin-room으로 재접속할 때 본인임을 증명하는 무작위 값. 입장 시
  // 서버가 발급해 그 소켓에게만 알려주며, 다른 플레이어에게는 노출하지 않는다.
  rejoinToken: string;
  // 대기실에서 "준비" 버튼을 눌렀는지. 방장(joinedPlayers[0])은 준비 대신
  // 게임 시작 버튼을 쓰므로 이 값을 참고하지 않는다.
  isReady: boolean;
}

// playerId(player-1, player-2...)는 순차적이라 쉽게 추측할 수 있으므로,
// rejoin-room이 그 값만으로 자리를 넘겨주면 남의 좌석(과 비공개 카드)을
// 가로챌 수 있다. 이 토큰을 비교해 실제로 그 자리를 발급받은 브라우저인지
// 확인한다. 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 걸러낸다.
function safeTokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// 로그인 계정에 연결된 자리를 재접속할 때는 토큰 일치만으로 끝내지 않고,
// 요청에 실린 idToken이 실제로 그 uid의 것인지까지 한 번 더 확인한다.
// 게스트 자리(uid가 없음)라면 추가 확인 없이 통과시킨다.
async function verifyRejoinIdentity(
  idToken: string | undefined,
  expectedUid: string | null,
): Promise<boolean> {
  if (!expectedUid) return true;

  if (!idToken || !adminAuth) return false;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    return decoded.uid === expectedUid;
  } catch {
    return false;
  }
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

// 방 목록에 표시할 방 이름을 정리한다. 비어있거나 없으면 null을 반환해
// 호출부에서 "OO의 방" 같은 기본값을 쓰도록 한다.
function sanitizeRoomName(name: unknown): string | null {
  if (typeof name !== "string") return null;

  const trimmed = name.trim().slice(0, MAX_ROOM_NAME_LENGTH);

  return trimmed.length > 0 ? trimmed : null;
}

// 방 비밀번호를 정리한다. 비어있거나 없으면 null(=비밀번호 없음)을 반환한다.
function sanitizeRoomPassword(password: unknown): string | null {
  if (typeof password !== "string") return null;

  const trimmed = password.trim().slice(0, MAX_ROOM_PASSWORD_LENGTH);

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
  // 방 목록에 표시되는 이름
  name: string;
  // 값이 있으면 참가(방 목록 클릭이든 코드 입력이든) 시 이 값과 일치하는
  // 비밀번호를 함께 보내야 한다. 모든 방은 항상 방 목록(list-rooms)에
  // 노출되며, 이 값은 그중 잠긴 방을 표시하는 용도로만 쓰인다.
  password: string | null;
  maxPlayers: number;
  joinedPlayers: JoinedPlayer[];
  game: SeotdaGame | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  // 게임 종료 후 "다시하기"에 동의한 플레이어 id 목록
  restartVotes: Set<string>;
  // 다시하기 전, 파산해서 관전/나가기 결정을 아직 하지 않은 플레이어 id 목록
  pendingBankruptcy: Set<string>;
  // 방이 사라지면 같이 사라지는 순수 인메모리 채팅 기록(최근 것만 유지)
  chatMessages: ChatMessage[];
}

const rooms = new Map<string, Room>();

function createClientGameState(
  game: SeotdaGame,
  playerId: string,
): ClientGameState {
  const state = game.getState();

  // 방을 나간 플레이어는 화면 목록에서 완전히 제외한다.
  const currentPlayerId = state.players[state.currentPlayerIndex]?.id ?? null;

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

// 쇼다운에서 재경기가 결정되면(구사/멍텅구리 구사) 공개된 패를 잠시 보여준
// 뒤, 다이한 사람을 뺀 나머지끼리 카드 2장만 새로 받아 곧바로 재대결한다
// (34장 — 앤티도 베팅도 새로 생기지 않는 즉시 승부). 그 결과가 또 재경기
// 조건이면 이 함수가 재귀적으로 다시 예약된다.
function scheduleShowdownFollowup(room: Room) {
  setTimeout(() => {
    if (!room.game || !room.game.hasPendingRedeal()) return;

    try {
      room.game.confirmPendingRedeal();
      broadcastGameState(room);
    } catch (error) {
      console.warn("재경기 확정 실패(무시):", error);
      return;
    }

    if (room.game.hasPendingRedeal()) {
      scheduleShowdownFollowup(room);
    }
  }, SHOWDOWN_REVEAL_PAUSE_MS);
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
    isReady: player.isReady,
  }));
}

// room-created/room-joined 이벤트에 공통으로 실리는 방 정보(방별 개인 정보인
// playerId/rejoinToken 제외). 비밀번호 원문은 절대 클라이언트로 보내지 않는다.
function roomInfoPayload(room: Room) {
  return {
    name: room.name,
    hasPassword: room.password !== null,
    playerCount: room.joinedPlayers.length,
    maxPlayers: room.maxPlayers,
    players: roomPlayersPayload(room),
    chatMessages: room.chatMessages,
  };
}

// 로비 화면(list-rooms)에 노출할 방 목록 — 모든 방은 항상 목록에 뜨며,
// 이미 시작됐거나 정원이 찬 방만 제외한다. 비밀번호가 걸린 방은
// hasPassword로만 표시하고, 원문은 절대 포함하지 않는다.
function publicRoomsPayload(): RoomListEntry[] {
  const entries: RoomListEntry[] = [];

  for (const [roomId, room] of rooms) {
    if (room.game) continue;
    if (room.joinedPlayers.length >= room.maxPlayers) continue;

    entries.push({
      roomId,
      name: room.name,
      hasPassword: room.password !== null,
      playerCount: room.joinedPlayers.length,
      maxPlayers: room.maxPlayers,
    });
  }

  return entries;
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
  try {
    room.game.start(false);
    broadcastGameState(room);
  } catch (error) {
    console.warn("다시하기 시작 실패(무시):", error);
  }
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

  try {
    room.game.start(false);
    broadcastGameState(room);
  } catch (error) {
    console.warn("다시하기 시작 실패(무시):", error);
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

  const leavingPlayer = room.joinedPlayers.find((p) => p.id === playerId);

  room.joinedPlayers = room.joinedPlayers.filter((p) => p.id !== playerId);
  room.restartVotes.delete(playerId);

  const wasPendingBankruptcy = room.pendingBankruptcy.delete(playerId);

  let causedAutoLoss = false;

  if (room.game) {
    try {
      // 진행 중인 판이라면 다이로 처리해 판돈을 잃게 하고, 이후 판부터는
      // 완전히 제외한다(관전자로도 남지 않고 화면에서도 사라진다).
      causedAutoLoss = room.game.leaveGame(playerId);
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

  // 나가고 남은 참가자가 단 한 명뿐이면, 그 판/방 결과와 무관하게 그
  // 사람을 승자로 확정한다(마지막까지 남은 사람이 이긴 것으로 처리).
  if (room.joinedPlayers.length === 1 && room.game && !causedAutoLoss) {
    try {
      room.game.declareSoleSurvivorWinner(room.joinedPlayers[0].id);
    } catch {
      // 이미 게임에 없는 플레이어 등 예외 상황은 무시한다.
    }
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
    ({
      maxPlayers,
      name,
      roomName,
      password,
      idToken,
    }: {
      maxPlayers: number;
      name?: string;
      roomName?: string;
      password?: string;
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
          message:
            "방 만들기를 너무 자주 시도했습니다. 잠시 후 다시 시도해주세요.",
        });

        return;
      }

      const roomId = createRoomId();

      const safeMaxPlayers = Number.isInteger(maxPlayers)
        ? Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers))
        : MIN_PLAYERS;

      // 로그인 계정의 실제 닉네임/보유 칩을 조회하려면 idToken 검증 +
      // Firestore 조회가 필요해 시간이 걸린다. 방 생성 응답을 그만큼 늦추지
      // 않도록, 우선 클라이언트가 입력한 이름(또는 기본값)으로 방을 즉시
      // 만들어 응답하고, 조회 결과는 끝나는 대로 뒤이어 반영한다. 게임은
      // 최소 한 명이 더 들어와야 시작되므로 실제 시작 전엔 항상 반영이
      // 끝나 있다.
      const hostRejoinToken = randomUUID();
      const hostName = sanitizeName(name) ?? "플레이어 1";

      const room: Room = {
        name: sanitizeRoomName(roomName) ?? `${hostName}의 방`,
        password: sanitizeRoomPassword(password),
        maxPlayers: safeMaxPlayers,
        joinedPlayers: [
          {
            id: "player-1",
            name: hostName,
            socketId: socket.id,
            uid: null,
            startingChips: STARTING_CHIPS,
            rejoinToken: hostRejoinToken,
            isReady: false,
          },
        ],
        game: null,
        disconnectTimers: new Map(),
        restartVotes: new Set(),
        pendingBankruptcy: new Set(),
        chatMessages: [],
      };

      rooms.set(roomId, room);

      socket.join(roomId);

      socket.emit("room-created", {
        roomId,
        playerId: "player-1",
        rejoinToken: hostRejoinToken,
        ...roomInfoPayload(room),
      });

      if (idToken) {
        resolveJoiningPlayer(idToken, name)
          .then((resolved) => {
            const player = room.joinedPlayers.find((p) => p.id === "player-1");

            if (!player) return;

            player.uid = resolved.uid;
            player.startingChips = resolved.startingChips;

            if (resolved.name) {
              player.name = resolved.name;
            }

            broadcastPlayersUpdated(roomId, room);
          })
          .catch((err) => {
            console.error("로그인 정보 반영 실패:", err);
          });
      }
    },
  );

  // 로비 화면에서 참가 가능한 공개방 목록을 요청한다. 실시간으로 계속
  // 밀어주지 않고 요청-응답 방식으로만 처리한다 — 클라이언트가 로비 화면에
  // 머무는 동안 주기적으로 다시 요청한다.
  socket.on("list-rooms", () => {
    socket.emit("rooms-list", publicRoomsPayload());
  });

  socket.on(
    "join-room",
    async ({
      roomId,
      name,
      password,
      idToken,
    }: {
      roomId: string;
      name?: string;
      password?: string;
      idToken?: string;
    }) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error-message", {
          message: "존재하지 않는 방입니다.",
        });

        return;
      }

      if (
        room.password !== null &&
        !safeTokensMatch(password ?? "", room.password)
      ) {
        socket.emit("error-message", {
          message: "비밀번호가 올바르지 않습니다.",
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

      const joinerRejoinToken = randomUUID();

      room.joinedPlayers.push({
        id: playerId,
        name: resolvedName,
        socketId: socket.id,
        uid: resolved.uid,
        startingChips: resolved.startingChips,
        rejoinToken: joinerRejoinToken,
        isReady: false,
      });

      socket.join(roomId);

      socket.emit("room-joined", {
        roomId,
        playerId,
        rejoinToken: joinerRejoinToken,
        ...roomInfoPayload(room),
      });

      broadcastPlayersUpdated(roomId, room);
    },
  );

  // 새로고침 등으로 끊겼던 세션을 복구합니다.
  //
  // playerId(player-1, player-2...)만으로 자리를 내주면, 그 값을 추측한
  // 다른 사람이 상대의 좌석(과 비공개 카드, 베팅 권한)을 그대로 가로챌 수
  // 있다. 그래서 입장 시 그 소켓에게만 발급했던 rejoinToken이 일치할 때만
  // 허용하고, 로그인 계정에 연결된 자리라면 idToken으로 uid까지 확인한다.
  socket.on(
    "rejoin-room",
    async ({
      roomId,
      playerId,
      rejoinToken,
      idToken,
    }: {
      roomId: string;
      playerId: string;
      rejoinToken?: string;
      idToken?: string;
    }) => {
      const room = rooms.get(roomId);

      const joined = room?.joinedPlayers.find((p) => p.id === playerId);

      if (!room || !joined) {
        socket.emit("rejoin-failed");
        return;
      }

      if (!rejoinToken || !safeTokensMatch(rejoinToken, joined.rejoinToken)) {
        socket.emit("rejoin-failed");
        return;
      }

      if (!(await verifyRejoinIdentity(idToken, joined.uid))) {
        socket.emit("rejoin-failed");
        return;
      }

      clearDisconnectTimer(room, playerId);

      joined.socketId = socket.id;

      socket.join(roomId);

      socket.emit("room-joined", {
        roomId,
        playerId,
        rejoinToken: joined.rejoinToken,
        ...roomInfoPayload(room),
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

  // 방장을 제외한 참가자가 준비 상태를 켜고 끈다. 방장(joinedPlayers[0])은
  // 준비 버튼 대신 게임 시작 버튼을 쓰므로 이 이벤트를 무시한다.
  socket.on("toggle-ready", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room || room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId || room.joinedPlayers[0]?.id === playerId) return;

    const player = room.joinedPlayers.find((p) => p.id === playerId);

    if (!player) return;

    player.isReady = !player.isReady;

    broadcastPlayersUpdated(roomId, room);
  });

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
      const host = room.joinedPlayers[0];
      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!host || playerId !== host.id) {
        socket.emit("error-message", {
          message: "방장만 게임을 시작할 수 있습니다.",
        });

        return;
      }

      const notReady = room.joinedPlayers.some(
        (player) => player.id !== host.id && !player.isReady,
      );

      if (notReady) {
        socket.emit("error-message", {
          message: "모든 참가자가 준비를 완료해야 시작할 수 있습니다.",
        });

        return;
      }

      const players = room.joinedPlayers.map((player) => ({
        name: player.name,
        chips: player.startingChips,
      }));

      room.game = new SeotdaGame(players);
    }

    try {
      room.game.start();
      broadcastGameState(room);
    } catch (error) {
      // 방 정원이 차면 참가자 전원의 클라이언트가 각자 카운트다운 후 각자
      // start-game을 보낼 수 있다. 이미 다른 클라이언트가 먼저 시작시켰다면
      // 뒤이어 도착한 요청은 조용히 무시한다 — 예외를 그대로 던지면 서버
      // 프로세스 전체가 죽어서 무관한 다른 방까지 전부 끊겨버린다.
      console.warn("게임 시작 실패(무시):", error);
    }
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

  // 로그인 계정의 영구 보유 칩(rankings/{uid}.money)이 0 이하로 파산해
  // 있으면 1만 칩으로 채워준다. 로비 화면이 보유 칩을 불러올 때 호출한다.
  // 이미 0보다 크면 아무것도 바꾸지 않는다(멱등적 — 중복 호출해도 안전).
  socket.on("claim-bankruptcy-refill", ({ idToken }: { idToken?: string }) => {
    if (!idToken || !adminAuth || !adminDb) return;

    const auth = adminAuth;
    const db = adminDb;

    auth
      .verifyIdToken(idToken)
      .then(async (decoded) => {
        const docRef = db.collection(RANKINGS_COLLECTION).doc(decoded.uid);

        const money = await db.runTransaction(async (tx) => {
          const snapshot = await tx.get(docRef);
          const existing = snapshot.data() as RankingEntry | undefined;

          if (!existing || existing.money > 0) {
            return existing?.money ?? STARTING_CHIPS;
          }

          tx.update(docRef, { money: STARTING_CHIPS });

          return STARTING_CHIPS;
        });

        socket.emit("bankruptcy-refill-result", { money });
      })
      .catch((err) => {
        console.warn("파산 칩 지급 실패:", err);
      });
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

  socket.on("all-in", (roomId: string) => {
    const room = rooms.get(roomId);

    if (!room || !room.game) return;

    const playerId = findPlayerIdBySocket(room, socket.id);

    if (!playerId) return;

    try {
      room.game.allIn(playerId);

      broadcastGameState(room);
    } catch (error) {
      socket.emit("error-message", {
        message:
          error instanceof Error ? error.message : "올인에 실패했습니다.",
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

  // 하프/쿼터/더블 — 베팅을 열 때든 레이즈할 때든 같은 이벤트 하나로
  // 처리한다. 목표 금액(현재 팟 × 배율)은 서버가 계산하므로 클라이언트는
  // 배율(ratio)만 보낸다.
  socket.on(
    "raise",
    ({ roomId, ratio }: { roomId: string; ratio: RaiseRatio }) => {
      const room = rooms.get(roomId);

      if (!room || !room.game) return;

      if (ratio !== "half" && ratio !== "quarter" && ratio !== "double") {
        return;
      }

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      try {
        room.game.raiseByRatio(playerId, ratio);

        broadcastGameState(room);
      } catch (error) {
        socket.emit("error-message", {
          message:
            error instanceof Error ? error.message : "베팅에 실패했습니다.",
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

        if (room.game.hasPendingRedeal()) {
          scheduleShowdownFollowup(room);
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

  socket.on(
    "chat-message",
    ({ roomId, text }: { roomId: string; text: string }) => {
      const room = rooms.get(roomId);

      if (!room) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      const player = room.joinedPlayers.find((p) => p.id === playerId);

      if (!player) return;

      const trimmed =
        typeof text === "string" ? text.trim().slice(0, MAX_CHAT_LENGTH) : "";

      if (!trimmed) return;

      if (
        isRateLimited(
          socket.id,
          chatMessageTimestamps,
          CHAT_MESSAGE_LIMIT,
          CHAT_MESSAGE_WINDOW_MS,
        )
      ) {
        socket.emit("error-message", {
          message: "메시지를 너무 자주 보냈습니다. 잠시 후 다시 시도해주세요.",
        });

        return;
      }

      const message: ChatMessage = {
        id: randomUUID(),
        playerId,
        name: player.name,
        text: trimmed,
        timestamp: Date.now(),
      };

      room.chatMessages.push(message);

      if (room.chatMessages.length > MAX_CHAT_HISTORY) {
        room.chatMessages.splice(
          0,
          room.chatMessages.length - MAX_CHAT_HISTORY,
        );
      }

      io.to(roomId).emit("chat-message", message);
    },
  );

  // 입력 중 표시 — 아무것도 저장하지 않고, 지금 이 순간 누가 입력 중인지만
  // 같은 방의 다른 사람들에게 전달한다(본인 제외).
  socket.on(
    "chat-typing",
    ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
      const room = rooms.get(roomId);

      if (!room) return;

      const playerId = findPlayerIdBySocket(room, socket.id);

      if (!playerId) return;

      const player = room.joinedPlayers.find((p) => p.id === playerId);

      if (!player) return;

      if (
        isRateLimited(
          socket.id,
          chatTypingTimestamps,
          CHAT_TYPING_LIMIT,
          CHAT_TYPING_WINDOW_MS,
        )
      ) {
        return;
      }

      socket.to(roomId).emit("chat-typing", {
        playerId,
        name: player.name,
        isTyping: Boolean(isTyping),
      });
    },
  );

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
    chatMessageTimestamps.delete(socket.id);
    chatTypingTimestamps.delete(socket.id);

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
