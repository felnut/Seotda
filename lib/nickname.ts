// 게스트가 입력한 닉네임을 페이지 이동(홈 ↔ 방 찾기) 후에도 유지하기 위한
// 저장소. 로그인 계정은 서버가 프로필의 닉네임을 우선 사용하므로 이건
// 어디까지나 로컬 기본값일 뿐이다.

const NICKNAME_STORAGE_KEY = "seotda-nickname";

export function loadNickname(): string {
  return localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
}

export function saveNickname(name: string): void {
  if (name) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  } else {
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
  }
}
