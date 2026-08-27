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

if (hasCredentials) {
  // tsx로 서버를 재시작 없이 재로드할 때 앱이 중복 초기화되지 않도록 캐시한다.
  app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
} else {
  console.warn(
    "Firebase 서비스 계정 환경변수가 없어 로그인/랭킹 기능이 비활성화됩니다. (게스트 플레이는 정상 동작)",
  );
}

export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
