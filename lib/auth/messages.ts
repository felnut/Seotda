// 로그인/계정 연결 오류 코드 → 사용자에게 보여줄 문구 (서버·클라이언트 공용)
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "아직 설정되지 않은 로그인 방식이에요.",
  denied: "로그인이 취소되었어요.",
  state: "로그인 요청이 만료되었어요. 다시 시도해주세요.",
  failed: "로그인에 실패했어요. 잠시 후 다시 시도해주세요.",
  already_linked: "이미 다른 계정에 연결된 로그인이에요.",
  slot_taken: "이 방식의 로그인이 이미 연결되어 있어요.",
  last_identity: "마지막 로그인 방식은 해제할 수 없어요.",
};

export function authErrorMessage(code: string | undefined | null) {
  return AUTH_ERROR_MESSAGES[code ?? ""] ?? AUTH_ERROR_MESSAGES.failed;
}
