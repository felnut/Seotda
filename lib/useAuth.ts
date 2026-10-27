"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function useAuthState(): { user: User | null; ready: boolean } {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({
    user: null,
    ready: false,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // 로그인 상태 복원은 최초 화면에 당장 필요한 게 아닌데도, 여기서 바로
    // firebase/auth를 동적 import하면 브라우저가 아직 초기 렌더링에 바쁜
    // 타이밍에 100KB 넘는 청크가 끼어들어 LCP/TTI를 늦춘다. 그래서 브라우저가
    // 한가해진 뒤(requestIdleCallback)로 미루고, 이를 지원하지 않는
    // 브라우저에서는 setTimeout으로 대체한다.
    const runWhenIdle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (fn: () => void) => window.setTimeout(fn, 1);
    const cancelIdle =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const idleId = runWhenIdle(() => {
      getFirebaseAuth().then(async (auth) => {
        if (cancelled) return;

        if (!auth) {
          setState({ user: null, ready: true });
          return;
        }

        const { onAuthStateChanged } = await import("firebase/auth");

        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!cancelled) setState({ user, ready: true });
        });
      }).catch((error) => {
        console.error("로그인 상태를 복원하지 못했습니다:", error);
        // 복원 실패는 게스트 확정이 아니다. 저장된 계정 좌석을 지우지 않도록
        // ready=false를 유지하고 새로고침으로 다시 시도할 수 있게 한다.
      });
    });

    return () => {
      cancelled = true;
      cancelIdle(idleId);
      unsubscribe?.();
    };
  }, []);

  return state;
}

export function useAuth(): User | null {
  return useAuthState().user;
}
