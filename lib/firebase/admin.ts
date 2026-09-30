import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

const hasCredentials =
  !!process.env.FIREBASE_PROJECT_ID &&
  !!process.env.FIREBASE_CLIENT_EMAIL &&
  !!process.env.FIREBASE_PRIVATE_KEY;

// Firebase 서비스 계정 환경변수가 없으면(로컬 개발 등) 로그인/랭킹 기능만
// 비활성화하고, 게스트 플레이는 그대로 동작해야 하므로 여기서 앱을 만들지 않는다.
let app: App | null = null;

// 호스팅 서비스 화면에 붙여넣다 보면 앞뒤에 공백이나 따옴표가 딸려 들어오기
// 쉬우므로 걷어낸다. (\n 문자열은 실제 줄바꿈으로 바꾼다.)
function normalizePrivateKey(key: string | undefined) {
  return key
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

if (hasCredentials) {
  try {
    // tsx로 서버를 재시작 없이 재로드할 때 앱이 중복 초기화되지 않도록 캐시한다.
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
            privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
          }),
        });
  } catch (err) {
    // 키가 잘못돼도 서버 전체가 죽지 않고 로그인/랭킹만 꺼지게 한다.
    console.error("Firebase Admin 초기화 실패 (서비스 계정 키 확인 필요):", err);
  }
} else {
  console.warn(
    "Firebase 서비스 계정 환경변수가 없어 로그인/랭킹 기능이 비활성화됩니다. (게스트 플레이는 정상 동작)",
  );
}

export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
