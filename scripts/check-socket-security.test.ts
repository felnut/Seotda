import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { io, type Socket } from "socket.io-client";
import type { ClientGameState } from "../types/seotda";

function receive<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5_000);
    function onEvent(value: T) {
      clearTimeout(timer);
      resolve(value);
    }
    socket.once(event, onEvent);
  });
}

test("malformed packets cannot kill the server or disclose opponents' card identities", { timeout: 25_000 }, async (t) => {
  const env = { ...process.env, PORT: "0", CLIENT_URL: "http://localhost:3000" };
  // This regression server must never access real accounts or LLM services.
  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "GROQ_API_KEY"]) {
    delete env[key as keyof typeof env];
  }
  const server = spawn(process.execPath, ["--import", "tsx", "server/socket.ts"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const sockets: Socket[] = [];
  t.after(() => {
    for (const socket of sockets) socket.close();
    server.kill();
  });
  const port = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start")), 10_000);
    server.once("error", reject);
    server.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/running on port (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  const host = io(`http://127.0.0.1:${port}`, { transports: ["websocket"] });
  sockets.push(host);
  await receive(host, "connect");
  for (const event of ["create-room", "join-room", "remove-ai-player", "chat-message"]) {
    const rejected = receive(host, "error-message");
    host.emit(event, null);
    await rejected;
  }
  const created = receive<{ roomId: string; playerId: string; rejoinToken: string }>(host, "room-created");
  host.emit("create-room", { name: "host", password: "secret", maxPlayers: 4 });
  const { roomId, playerId, rejoinToken } = await created;
  const duplicate = receive(host, "error-message");
  host.emit("join-room", { roomId, name: "second seat", password: "secret" });
  await duplicate;
  const secondRoom = receive(host, "error-message");
  host.emit("create-room", { name: "second room" });
  await secondRoom;
  const rejoined = receive(host, "room-joined");
  host.emit("rejoin-room", { roomId, playerId, rejoinToken });
  await rejoined;
  const rejected = receive(host, "error-message");
  host.emit("join-room", { roomId, password: {} });
  await rejected;
  const guest = io(`http://127.0.0.1:${port}`, { transports: ["websocket"] });
  sockets.push(guest);
  await receive(guest, "connect");
  const joined = receive(guest, "room-joined");
  const duplicateJoin = receive(guest, "error-message");
  guest.emit("join-room", { roomId, name: "guest", password: "secret" });
  guest.emit("join-room", { roomId, name: "duplicate guest", password: "secret" });
  await joined;
  await duplicateJoin;
  const ready = receive(host, "players-updated");
  guest.emit("toggle-ready", roomId);
  await ready;
  const statePromise = receive<ClientGameState>(host, "game-state");
  host.emit("start-game", roomId);
  const state = await statePromise;
  assert.equal(state.players.length, 2);
  const ownCards = state.players.find((player) => player.id === playerId)!.cards;
  const opponentCards = state.players.find((player) => player.id !== playerId)!.cards;
  assert.ok(ownCards.length > 0);
  assert.ok(ownCards.every((card) => card.revealed && card.card && card.id === card.card.id));
  assert.ok(opponentCards.length > 0);
  assert.ok(opponentCards.every((card, index) => !card.revealed && !card.card && card.id === `hidden-${index}`));
  assert.equal(server.exitCode, null);
  host.emit("leave-room", roomId);
  const freshRoom = receive<{ roomId: string }>(host, "room-created");
  host.emit("create-room", { name: "after leaving" });
  assert.notEqual((await freshRoom).roomId, roomId);
});
