import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

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

if (!hasConfig && typeof window !== "undefined") {
  console.warn(
    "Firebase 클라이언트 환경변수가 없어 로그인/랭킹 기능이 비활성화됩니다. (게스트 플레이는 정상 동작)",
  );
}

// firebase/app·auth·firestore는 게스트 플레이에는 전혀 필요 없고 용량도
// 작지 않다(특히 firestore는 re2js WASM까지 딸려온다). 그래서 최상단에서
// 즉시 import하지 않고, 실제로 로그인/랭킹 기능이 쓰일 때만 동적으로
// 불러와 초기 로딩 번들에서 뺀다. Promise를 캐싱해 중복 초기화를 막는다.
let appPromise: Promise<FirebaseApp | null> | null = null;

async function loadApp(): Promise<FirebaseApp | null> {
  if (!hasConfig) return null;

  if (!appPromise) {
    appPromise = import("firebase/app").then(
      ({ getApps, getApp, initializeApp }) =>
        getApps().length ? getApp() : initializeApp(firebaseConfig),
    );
  }

  return appPromise;
}

let authPromise: Promise<Auth | null> | null = null;

export async function getFirebaseAuth(): Promise<Auth | null> {
  if (!hasConfig) return null;

  if (!authPromise) {
    authPromise = (async () => {
      const app = await loadApp();

      if (!app) return null;

      // getAuth()는 signInWithPopup/signInWithRedirect 대비용으로
      // authDomain에 숨겨진 iframe(auth/iframe.js, ~90KB)을 항상 띄우고
      // Google API에 설정을 확인하는 요청까지 보낸다 — 모바일 환경에서
      // 이 체인 하나가 LCP를 몇 초씩 늦추는 게 Lighthouse로 확인됐다.
      // 이 앱은 Google Identity Services 토큰을 signInWithCredential로
      // 바꿔 로그인하는 방식만 쓰고 팝업/리다이렉트는 전혀 안 쓰므로,
      // initializeAuth로 그 리졸버 자체를 빼서 iframe을 만들지 않는다.
      const { initializeAuth, browserLocalPersistence } = await import(
        "firebase/auth"
      );

      return initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: undefined,
      });
    })();
  }

  return authPromise;
}

let dbPromise: Promise<Firestore | null> | null = null;

export async function getFirebaseDb(): Promise<Firestore | null> {
  if (!hasConfig) return null;

  if (!dbPromise) {
    dbPromise = (async () => {
      const app = await loadApp();

      if (!app) return null;

      const { getFirestore } = await import("firebase/firestore");

      return getFirestore(app);
    })();
  }

  return dbPromise;
}
