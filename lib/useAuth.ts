"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function useAuth(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    getFirebaseAuth().then(async (auth) => {
      if (!auth || cancelled) return;

      const { onAuthStateChanged } = await import("firebase/auth");

      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, setUser);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return user;
}
