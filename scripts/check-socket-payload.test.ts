import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidSocketPayload } from "../server/socketPayload";

test("reject malformed public event payloads before handlers run", () => {
  const events = [
    "create-room", "join-room", "rejoin-room", "add-ai-player",
    "remove-ai-player", "set-max-players", "claim-bankruptcy-refill",
    "bankruptcy-decision", "raise", "reveal-card", "select-hand",
    "chat-message", "chat-typing", "call", "leave-room",
  ];
  for (const event of events) {
    for (const payload of [null, undefined, [], 1, true]) {
      assert.equal(isValidSocketPayload(event, payload), false, event);
    }
  }
  for (const payload of [{ roomId: "r", password: {} }, { roomId: "r", idToken: 4 }]) {
    assert.equal(isValidSocketPayload("join-room", payload), false);
  }
  assert.equal(isValidSocketPayload("rejoin-room", { roomId: "r", playerId: "p", rejoinToken: {} }), false);
  assert.equal(isValidSocketPayload("select-hand", { roomId: "r", indices: [0, "1"] }), false);
  assert.equal(isValidSocketPayload("set-max-players", { roomId: "r", maxPlayers: null }), false);
});

test("preserve guest creation, room actions and both AI payload forms", () => {
  assert.equal(isValidSocketPayload("create-room", {}), true);
  assert.equal(isValidSocketPayload("create-room", { name: "게스트", maxPlayers: 2 }), true);
  assert.equal(isValidSocketPayload("join-room", { roomId: "r", password: "secret" }), true);
  assert.equal(isValidSocketPayload("rejoin-room", { roomId: "r", playerId: "p", rejoinToken: "token" }), true);
  assert.equal(isValidSocketPayload("add-ai-player", "r"), true);
  assert.equal(isValidSocketPayload("add-ai-player", { roomId: "r", level: "normal" }), true);
  assert.equal(isValidSocketPayload("select-hand", { roomId: "r", indices: [0, 2] }), true);
  assert.equal(isValidSocketPayload("raise", { roomId: "r", ratio: "half" }), true);
  assert.equal(isValidSocketPayload("call", "r"), true);
  assert.equal(isValidSocketPayload("list-rooms", undefined), true);
});
