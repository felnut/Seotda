import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { restoreRoomSession } from "../lib/rejoin";
import type { StoredSession } from "../lib/session";

const session: StoredSession = {
  roomId: "test-room",
  playerId: "test-player",
  rejoinToken: "test-rejoin-token",
};

class FakeSocket extends EventEmitter {
  connected = true;
  requests: (StoredSession & { idToken?: string })[] = [];

  override emit(event: string, ...args: unknown[]): boolean {
    if (event === "rejoin-room") {
      this.requests.push(args[0] as StoredSession & { idToken?: string });
      return true;
    }
    return super.emit(event, ...args);
  }
}

test("waits for restored authentication instead of treating loading as a guest", async () => {
  const socket = new FakeSocket();
  const stopWaiting = restoreRoomSession(socket, session, null, false, assert.fail);
  socket.emit("connect");
  assert.equal(socket.requests.length, 0);
  stopWaiting();

  const stop = restoreRoomSession(socket, session, {
    getIdToken: async () => "restored-id-token",
  }, true, assert.fail);
  await Promise.resolve();
  assert.equal(socket.requests[0]?.idToken, "restored-id-token");
  stop();
});

test("restores guest seats after every socket reconnection and removes its handler", () => {
  const socket = new FakeSocket();
  socket.connected = false;
  const stop = restoreRoomSession(socket, session, null, true, assert.fail);
  assert.equal(socket.requests.length, 0);
  socket.connected = true;
  socket.emit("connect");
  socket.emit("connect");
  assert.equal(socket.requests.length, 2);
  assert.equal(socket.requests[0]?.rejoinToken, session.rejoinToken);
  stop();
  socket.emit("connect");
  assert.equal(socket.requests.length, 2);
});

test("does not submit a stale token after cleanup", async () => {
  const socket = new FakeSocket();
  let resolveToken!: (token: string) => void;
  const token = new Promise<string>((resolve) => { resolveToken = resolve; });
  const stop = restoreRoomSession(socket, session, {
    getIdToken: () => token,
  }, true, assert.fail);
  stop();
  resolveToken("stale-id-token");
  await Promise.resolve();
  assert.equal(socket.requests.length, 0);
});

test("reports token failure without submitting an unauthenticated rejoin", async () => {
  const socket = new FakeSocket();
  let errors = 0;
  const stop = restoreRoomSession(socket, session, {
    getIdToken: async () => { throw new Error("token unavailable"); },
  }, true, () => { errors++; });
  await Promise.resolve();
  assert.equal(socket.requests.length, 0);
  assert.equal(errors, 1);
  stop();
});
