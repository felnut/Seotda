import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasConfig =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.authDomain &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.appId;

// Firebase 환경변수가 없으면(로컬 개발 등) 로그인/랭킹 기능만 비활성화하고,
// 게스트 플레이는 그대로 동작해야 하므로 여기서 앱을 만들지 않는다.
let app: FirebaseApp | null = null;

if (hasConfig) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} else if (typeof window !== "undefined") {
  console.warn(
    "Firebase 클라이언트 환경변수가 없어 로그인/랭킹 기능이 비활성화됩니다. (게스트 플레이는 정상 동작)",
  );
}

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
