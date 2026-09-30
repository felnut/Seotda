// 계정 통합 — 구글·깃허브·네이버·카카오 로그인을 하나의 내부 계정(UUID)에
// 최대 4개까지 연결한다. 모든 로그인은 서버를 거쳐 이 계정 ID로 파이어베이스
// 커스텀 토큰을 발급받으므로, 소켓 서버·랭킹·프로필이 쓰는 uid는 로그인
// 방식과 상관없이 같다.
//
// Firestore (클라이언트 접근 없음 — 규칙상 기본 거부, 서버만 읽고 쓴다)
//   users/{accountId}        { createdAt, identities: { [provider]: { id, linkedAt } } }
//   identities/{provider}:{id} { userId, provider, createdAt }   ← 로그인 시 계정 찾기용

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { PROFILES_COLLECTION } from "@/lib/profile";
import { RANKINGS_COLLECTION } from "@/lib/ranking";

export const LOGIN_PROVIDERS = ["google", "github", "naver", "kakao"] as const;

export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];

export type AccountErrorCode =
  | "already_linked"
  | "slot_taken"
  | "last_identity"
  | "not_configured";

export class AccountError extends Error {
  constructor(public code: AccountErrorCode) {
    super(code);
  }
}

const USERS = "users";
const IDENTITIES = "identities";

const identityKey = (provider: LoginProvider, providerId: string) =>
  `${provider}:${providerId}`;

function db() {
  if (!adminDb || !adminAuth) throw new AccountError("not_configured");

  return { db: adminDb, auth: adminAuth };
}

// 이 로그인 시스템이 생기기 전에 만들어진 계정을 찾는다.
// (구글은 파이어베이스 uid, 네이버·카카오는 "naver:<id>" 형태 uid가 곧 계정이었다.)
async function findLegacyUid(
  provider: LoginProvider,
  providerId: string,
): Promise<string | null> {
  const { auth } = db();

  try {
    if (provider === "google" || provider === "github") {
      const record = await auth.getUserByProviderUid(
        `${provider}.com`,
        providerId,
      );

      return record.uid;
    }

    return (await auth.getUser(identityKey(provider, providerId))).uid;
  } catch {
    return null;
  }
}

// 레거시 계정이 아직 users 문서가 없으면, 지금 가진 로그인 정보를 기록해둔다.
// 이미 관리되는 계정(users 문서 있음)은 건드리지 않는다.
export async function ensureIdentities(uid: string): Promise<void> {
  const { db: firestore, auth } = db();
  const userRef = firestore.collection(USERS).doc(uid);

  if ((await userRef.get()).exists) return;

  const found: { provider: LoginProvider; id: string }[] = [];

  try {
    const record = await auth.getUser(uid);

    for (const info of record.providerData) {
      if (info.providerId === "google.com") {
        found.push({ provider: "google", id: info.uid });
      } else if (info.providerId === "github.com") {
        found.push({ provider: "github", id: info.uid });
      }
    }
  } catch {
    // 인증 쪽에 없는 uid — 아래에서 빈 계정으로 기록한다.
  }

  const [prefix, rest] = uid.split(":");

  if ((prefix === "naver" || prefix === "kakao") && rest) {
    found.push({ provider: prefix, id: rest });
  }

  const now = Date.now();
  const identities: Record<string, { id: string; linkedAt: number }> = {};

  for (const { provider, id } of found) {
    // 이미 다른 계정 소유로 등록된 로그인은 건드리지 않는다.
    const created = await firestore
      .collection(IDENTITIES)
      .doc(identityKey(provider, id))
      .create({ userId: uid, provider, createdAt: now })
      .then(() => true)
      .catch(() => false);

    if (created) identities[provider] = { id, linkedAt: now };
  }

  await userRef.set({ createdAt: now, identities }, { merge: true });
}

// 로그인/연결에 성공한 제공자 계정이 어느 내부 계정에 속하는지 알아낸다.
//  - linkTo가 있으면: 그 계정에 이 로그인을 연결한다.
//  - 없으면: 이미 연결된 계정을 찾고, 처음이면 새 계정(UUID)을 만든다.
export async function resolveAccount(
  provider: LoginProvider,
  providerId: string,
  name: string,
  linkTo?: string,
): Promise<string> {
  const { db: firestore, auth } = db();
  const identityRef = firestore
    .collection(IDENTITIES)
    .doc(identityKey(provider, providerId));
  const now = Date.now();

  if (linkTo) {
    await ensureIdentities(linkTo);

    const userRef = firestore.collection(USERS).doc(linkTo);

    return firestore.runTransaction(async (tx) => {
      const [identitySnap, userSnap] = await Promise.all([
        tx.get(identityRef),
        tx.get(userRef),
      ]);
      const owner = identitySnap.data()?.userId as string | undefined;

      if (owner) {
        if (owner === linkTo) return linkTo;

        throw new AccountError("already_linked");
      }

      if (userSnap.data()?.identities?.[provider]) {
        throw new AccountError("slot_taken");
      }

      tx.set(identityRef, { userId: linkTo, provider, createdAt: now });
      tx.set(
        userRef,
        { identities: { [provider]: { id: providerId, linkedAt: now } } },
        { merge: true },
      );

      return linkTo;
    });
  }

  const existing = (await identityRef.get()).data()?.userId as
    | string
    | undefined;

  if (existing) return existing;

  // 처음 보는 로그인: 예전 방식으로 만들어진 계정이 있으면 이어받고(칩·전적
  // 유지), 그렇지 않으면 새 UUID 계정을 만든다.
  const legacyUid = await findLegacyUid(provider, providerId);
  const adoptable =
    legacyUid && !(await firestore.collection(USERS).doc(legacyUid).get()).exists
      ? legacyUid
      : null;
  const uid = adoptable ?? randomUUID();
  const userRef = firestore.collection(USERS).doc(uid);

  const result = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(identityRef);
    const owner = snap.data()?.userId as string | undefined;

    // 동시에 들어온 다른 요청이 먼저 만들었다면 그쪽을 따른다.
    if (owner) return owner;

    tx.set(identityRef, { userId: uid, provider, createdAt: now });
    tx.set(userRef, {
      createdAt: now,
      identities: { [provider]: { id: providerId, linkedAt: now } },
    });

    return uid;
  });

  if (!adoptable && result === uid) {
    try {
      await auth.createUser({ uid, displayName: name.slice(0, 13) });
    } catch {
      // 이미 있으면 그대로 쓴다. (커스텀 토큰 로그인 시 없으면 자동 생성됨)
    }
  }

  return result;
}

export async function getLinkedProviders(
  uid: string,
): Promise<Record<LoginProvider, boolean>> {
  const { db: firestore } = db();

  await ensureIdentities(uid);

  const identities =
    (await firestore.collection(USERS).doc(uid).get()).data()?.identities ??
    {};

  return Object.fromEntries(
    LOGIN_PROVIDERS.map((provider) => [provider, !!identities[provider]]),
  ) as Record<LoginProvider, boolean>;
}

// 연결 해제 — 마지막 하나는 남겨둬야 한다(로그인할 방법이 없어지므로).
export async function unlinkProvider(
  uid: string,
  provider: LoginProvider,
): Promise<void> {
  const { db: firestore } = db();

  await ensureIdentities(uid);

  const userRef = firestore.collection(USERS).doc(uid);

  await firestore.runTransaction(async (tx) => {
    const identities = (await tx.get(userRef)).data()?.identities ?? {};
    const entry = identities[provider] as { id: string } | undefined;

    if (!entry) return;

    if (Object.keys(identities).length <= 1) {
      throw new AccountError("last_identity");
    }

    tx.delete(
      firestore.collection(IDENTITIES).doc(identityKey(provider, entry.id)),
    );
    tx.update(userRef, { [`identities.${provider}`]: FieldValue.delete() });
  });
}

export async function createLoginToken(
  uid: string,
  provider: LoginProvider,
): Promise<string> {
  const { auth } = db();

  return auth.createCustomToken(uid, { provider });
}

// 회원 탈퇴 — 이 계정에 딸린 모든 정보를 지운다(되돌릴 수 없다).
//  - 연결된 로그인(identities), 내부 계정(users)
//  - 닉네임(profiles), 칩·랭킹 기록(rankings)
//  - 파이어베이스 로그인 계정
// 같은 제공자로 다시 로그인하면 완전히 새 계정(칩 초기화)으로 시작한다.
export async function deleteAccount(uid: string): Promise<void> {
  const { db: firestore, auth } = db();

  // 연결 정보가 users 문서에만 있거나 identities에만 있어도 남지 않도록 둘 다 훑는다.
  const owned = await firestore
    .collection(IDENTITIES)
    .where("userId", "==", uid)
    .get();
  const batch = firestore.batch();

  owned.forEach((doc) => batch.delete(doc.ref));

  const identities =
    (await firestore.collection(USERS).doc(uid).get()).data()?.identities ??
    {};

  for (const provider of LOGIN_PROVIDERS) {
    const entry = identities[provider] as { id: string } | undefined;

    if (entry) {
      batch.delete(
        firestore.collection(IDENTITIES).doc(identityKey(provider, entry.id)),
      );
    }
  }

  batch.delete(firestore.collection(USERS).doc(uid));
  batch.delete(firestore.collection(PROFILES_COLLECTION).doc(uid));
  batch.delete(firestore.collection(RANKINGS_COLLECTION).doc(uid));

  await batch.commit();

  try {
    await auth.deleteUser(uid);
  } catch {
    // 이미 없는 계정이면 그대로 끝낸다.
  }
}
