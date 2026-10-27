// Socket.IO payloads come from the network; TypeScript annotations do not validate them.
const roomIdEvents = new Set([
  "join-next-round", "toggle-ready", "start-game", "restart-game",
  "call", "all-in", "check", "fold", "leave-room",
]);

const objectEvents: Record<string, string[]> = {
  "create-room": [],
  "join-room": ["roomId"],
  "rejoin-room": ["roomId", "playerId", "rejoinToken"],
  "add-ai-player": ["roomId"],
  "remove-ai-player": ["roomId", "playerId"],
  "set-max-players": ["roomId"],
  "claim-bankruptcy-refill": [],
  "bankruptcy-decision": ["roomId", "choice"],
  raise: ["roomId", "ratio"],
  "reveal-card": ["roomId"],
  "select-hand": ["roomId"],
  "chat-message": ["roomId", "text"],
  "chat-typing": ["roomId"],
};

export function isValidSocketPayload(event: string, payload: unknown): boolean {
  if (roomIdEvents.has(event) || (event === "add-ai-player" && typeof payload === "string")) {
    return typeof payload === "string" && payload.length > 0;
  }

  if (!Object.hasOwn(objectEvents, event)) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;

  const data = payload as Record<string, unknown>;
  if (objectEvents[event].some((key) => typeof data[key] !== "string")) return false;

  for (const key of ["roomId", "playerId", "rejoinToken", "idToken", "name", "roomName", "password", "level"]) {
    if (data[key] !== undefined && typeof data[key] !== "string") return false;
  }

  if (event === "create-room" && data.maxPlayers !== undefined && !Number.isInteger(data.maxPlayers)) return false;
  if (event === "set-max-players") return Number.isInteger(data.maxPlayers);
  if (event === "raise") return ["half", "quarter", "double"].includes(data.ratio as string);
  if (event === "bankruptcy-decision") return data.choice === "spectate" || data.choice === "leave";
  if (event === "chat-typing") return typeof data.isTyping === "boolean";
  if (event === "reveal-card") return Number.isInteger(data.cardIndex) && Number(data.cardIndex) >= 0 && Number(data.cardIndex) <= 2;
  if (event === "select-hand") {
    return Array.isArray(data.indices) && data.indices.length === 2 &&
      data.indices.every((index) => Number.isInteger(index) && index >= 0 && index <= 2) &&
      data.indices[0] !== data.indices[1];
  }

  return true;
}
