import { MIN_ROOM_PLAYERS } from "./constants";

export const SPECTATE_UNAVAILABLE_MESSAGE =
  "게임 진행에 필요한 인원이 부족하여 재접속 또는 추가 인원을 기다리세요.";

export interface SpectateCandidate {
  id: string;
  isAI: boolean;
  isSpectator: boolean;
}

// 파산한 플레이어가 "관전하기"를 골라도 게임이 이어질 수 있는지.
// 자신과 파산 결정을 기다리는 사람, 이미 관전 중인 사람을 뺀 나머지가
// 최소 인원 이상이고 그중 사람이 한 명 이상이어야 한다 — AI만 남으면 "다시
// 하기"를 눌러 다음 판을 시작시킬 사람이 없어 판이 그대로 멈춘다.
export function canSpectateAfterBankruptcy(
  players: SpectateCandidate[],
  bankruptIds: string[],
  myId: string,
): boolean {
  const remaining = players.filter(
    (player) =>
      player.id !== myId &&
      !player.isSpectator &&
      !bankruptIds.includes(player.id),
  );

  return (
    remaining.length >= MIN_ROOM_PLAYERS &&
    remaining.some((player) => !player.isAI)
  );
}
