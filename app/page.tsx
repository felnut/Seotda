"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BankruptcyNotice,
  ChatMessage,
  ClientGameState,
  RoomInfo,
  RoomPlayerInfo,
} from "@/types/seotda";
import { RaiseRatio } from "@/lib/seotda/bettingRound";
import { confirmBetAmount, RAISE_RATIO_LABEL } from "@/lib/seotda/bettingDisplay";
import { MIN_ROOM_PLAYERS } from "@/lib/seotda/constants";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { useAuth } from "@/lib/useAuth";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { PROFILES_COLLECTION, UserProfile } from "@/lib/profile";
import { RANKINGS_COLLECTION, RankingEntry } from "@/lib/ranking";
import { STARTING_CHIPS } from "@/lib/seotda/game";
import { socket } from "@/lib/socket";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import { loadNickname, saveNickname } from "@/lib/nickname";
import { playChatSound, playTurnSound, playSoundFile, CHIP_SOUND_PATHS } from "@/lib/sound";
import { RankingModal } from "./components/RankingModal";
import { GoogleSignInButton } from "./components/GoogleSignInButton";
import { ShareButtons } from "./components/ShareButtons";
import { AdSlot } from "./components/AdSlot";
import { buildJsonLd } from "@/lib/seo/structuredData";

// 인게임 UI(로비 다음 화면)는 방에 실제로 들어가야만 필요하다. 그 안의
// PlayerPanel·ChatPanel·ChipStack 등은 전부 이 파일과 별도 청크로
// 묶여 있어(app/components/GameRoomView.tsx), 로비만 보는 방문자는
// 그 JS·CSS를 아예 받지 않는다.
const GameRoomView = dynamic(() => import("./components/GameRoomView"), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center text-zinc-500">
      불러오는 중...
    </main>
  ),
});

// 애드센스 콘솔에서 로비 화면 좌우에 걸어둘 세로형(스카이스크래퍼) 광고
// 단위의 슬롯 ID. 같은 단위를 양쪽에 그대로 재사용한다.
const ADSENSE_LOBBY_SIDE_SLOT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_LOBBY_SIDE_SLOT_ID ?? "";

// layout.tsx의 메타데이터와 같은 값을 쓰지만, 서버 컴포넌트인
// layout.tsx를 클라이언트 컴포넌트인 이 파일에서 직접 import하면
// next/font 호출까지 클라이언트 번들에 끼어들 위험이 있어 값만 그대로
// 복사해 둔다.
const jsonLd = buildJsonLd({
  url: "https://seotda.felnut.com/",
  name: "섯다 - 친구와 온라인으로 즐기는 전통 카드 게임",
  description: "친구와 온라인으로 즐기는 전통 섯다 카드 게임",
  // git 히스토리 기준: 첫 커밋(2026-08-27) / 최신 커밋(2026-09-12).
  datePublished: "2026-08-27",
  dateModified: "2026-09-12",
  image: "https://seotda.felnut.com/opengraph-image",
});

// 설정 패널의 개별 항목들 — 서버와 무관한 개인 설정이라 이 브라우저에만
// 저장한다.
const SOUND_EFFECTS_STORAGE_KEY = "seotda-sound-effects";
const REDUCE_MOTION_STORAGE_KEY = "seotda-reduce-motion";
const CONFIRM_BETS_STORAGE_KEY = "seotda-confirm-bets";

// 방장이 최소 인원 미달인 채로 "게임 시작"을 눌렀을 때 보여주는 안내.
const NOT_ENOUGH_PLAYERS_ERROR = "함께할 플레이어가 부족합니다.";


function ProfilePanel({
  open,
  onClose,
  email,
  name,
  onNameChange,
  onSave,
  saving,
  saved,
  error,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  email: string | null;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-bold">설정</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {email && (
            <p className="mb-4 text-[14px] text-zinc-400">{email}로 로그인됨</p>
          )}

          <label className="mb-1.5 block text-[13px] font-medium text-zinc-500">
            닉네임
          </label>

          <input
            value={name}
            onChange={(event) => {
              onNameChange(event.target.value);
            }}
            placeholder="닉네임을 입력하세요"
            maxLength={13}
            className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] px-4 py-2.5 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          />

          <p className="mb-4 text-[13px] text-zinc-500">
            여기서 설정한 닉네임은 방 참가 시 이름을 따로 입력하지 않으면
            기본값으로 쓰이고, 랭킹에도 이 이름으로 표시돼요.
          </p>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-xl bg-gold px-6 py-2.5 text-[15px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? "저장 중..." : "닉네임 저장"}
          </button>

          {saved && (
            <p className="mt-2 text-center text-[13.5px] text-felt-bright">
              저장됐어요.
            </p>
          )}

          {error && (
            <p className="mt-2 text-center text-[13.5px] text-crimson-bright">
              {error}
            </p>
          )}

          <div className="my-5 border-t border-white/10" />

          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-xl border border-white/10 bg-white/3 px-6 py-2.5 text-[15px] font-semibold text-zinc-300 transition hover:border-crimson/40 hover:text-crimson-bright"
          >
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}

// 설정 패널의 켜고/끄는 항목 하나. 라벨·설명·스위치 마크업을 공통으로
// 묶어, 항목이 늘어나도 SettingsPanel 쪽은 나열만 하면 되게 한다.
function SettingToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-2.5">
      <div>
        <p className="text-[14px] font-semibold text-zinc-200">{label}</p>
        <p className="text-[12px] text-zinc-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-felt" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked
              ? "transform-[translateX(20px)]"
              : "transform-[translateX(0)]"
          }`}
        />
      </button>
    </div>
  );
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  soundEffects: boolean;
  onToggleSoundEffects: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  confirmBets: boolean;
  onToggleConfirmBets: () => void;
}

function SettingsPanel({
  open,
  onClose,
  soundEffects,
  onToggleSoundEffects,
  reduceMotion,
  onToggleReduceMotion,
  confirmBets,
  onToggleConfirmBets,
}: SettingsPanelProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[22.5px] font-bold">설정</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <SettingToggleRow
            label="효과음"
            description="누군가 베팅하거나(콜·하프·쿼터·더블·올인) 내 차례가 되거나 채팅이 오면 짧은 알림음을 재생합니다"
            checked={soundEffects}
            onToggle={onToggleSoundEffects}
          />

          <SettingToggleRow
            label="애니메이션 줄이기"
            description="카드·칩이 움직이는 연출을 최소화합니다"
            checked={reduceMotion}
            onToggle={onToggleReduceMotion}
          />

          <SettingToggleRow
            label="베팅 전 확인"
            description="하프·쿼터·더블·올인을 누르면 금액을 한 번 더 확인합니다"
            checked={confirmBets}
            onToggle={onToggleConfirmBets}
          />
        </div>
      </aside>
    </>
  );
}

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomHasPassword, setRoomHasPassword] = useState(false);

  const [playerId, setPlayerId] = useState("");

  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(MIN_ROOM_PLAYERS);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerInfo[]>([]);

  // 방 만들기 화면에서 입력하는 방 이름/비밀번호 (아직 만들어진 방의 값이 아님)
  const [createRoomName, setCreateRoomName] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  // 방 만들기/참가 시 사용할 닉네임 (비워두면 서버가 기본 이름을 붙여준다).
  // 게스트가 입력한 값은 방 찾기 화면 등 다른 페이지에서도 쓸 수 있도록
  // 로컬에 저장해둔다.
  const [displayName, setDisplayName] = useState("");

  const [error, setError] = useState("");

  // 방 만들기/참가 요청을 보내고 서버 응답을 기다리는 동안 true.
  // 버튼을 즉시 비활성화해 중복 요청을 막고, 네트워크 왕복 중임을 보여준다.
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // 게임 종료 후 "다시하기"에 내가 동의했는지, 그리고 전체 동의 현황
  const [hasVotedRestart, setHasVotedRestart] = useState(false);
  const [restartVotes, setRestartVotes] = useState(0);
  const [restartVotesTotal, setRestartVotesTotal] = useState(0);

  // 다시하기 시 파산한 플레이어가 있으면 전원에게 한 번 뜨는 알림.
  // 내가 그 대상이면 관전/나가기를 직접 골라야 한다.
  const [bankruptcyNotice, setBankruptcyNotice] =
    useState<BankruptcyNotice | null>(null);
  const [hasDecidedBankruptcy, setHasDecidedBankruptcy] = useState(false);

  // 누군가 방을 나갔을 때 5초간 보여주는 알림 메시지
  const [leaveNotice, setLeaveNotice] = useState<string | null>(null);

  // 방 채팅 — 데스크톱에서는 항상 열려 있는 도킹 패널이고, isChatOpen은
  // 화면이 좁을 때(모바일)만 여닫는 오버레이 표시 여부로 쓰인다.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // 지금 입력 중인 상대방들(플레이어 id → 이름). 서버가 "입력 중" 신호를
  // 보낼 때마다 갱신하고, 일정 시간 갱신이 없으면(연결이 끊기는 등) 자동으로
  // 지운다.
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingExpiryTimers = useRef<Record<string, number>>({});
  // 내가 입력 중임을 서버에 이미 알렸는지 — 매 타이핑마다 다시 보내지 않고
  // "입력 시작"과 "입력 멈춤"에만 신호를 보내기 위한 상태.
  const isTypingRef = useRef(false);
  const typingStopTimer = useRef<number | null>(null);

  // 설정 패널의 개인 설정들 — 서버와 동기화하지 않고 이 브라우저에만
  // 저장해둔다. 서버는 localStorage를 알 수 없으니 초기 렌더는 항상
  // 기본값으로 그려야 하이드레이션 경고가 나지 않는다. 저장된 값은
  // 마운트 이후 이펙트에서 한 번만 반영한다.
  const [soundEffects, setSoundEffects] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [confirmBets, setConfirmBets] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect --
     localStorage는 서버에서 읽을 수 없어, 하이드레이션 불일치를 피하려면
     마운트 이후에 한 번 동기화해야 한다(위 주석 참고). */
  useEffect(() => {
    if (window.localStorage.getItem(SOUND_EFFECTS_STORAGE_KEY) === "0") {
      setSoundEffects(false);
    }

    const storedReduceMotion = window.localStorage.getItem(
      REDUCE_MOTION_STORAGE_KEY,
    );

    if (storedReduceMotion === "1") {
      setReduceMotion(true);
    } else if (
      storedReduceMotion === null &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // 설정을 직접 바꾼 적이 없다면, OS의 "동작 줄이기" 설정을 그대로
      // 따라간다 — 매번 다시 꺼야 하는 불편을 없앤다.
      setReduceMotion(true);
    }

    if (window.localStorage.getItem(CONFIRM_BETS_STORAGE_KEY) === "1") {
      setConfirmBets(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // reduceMotion은 이 컴포넌트 밖의 CSS 애니메이션(카드 등장, 칩 던지기
  // 등)에도 적용돼야 하므로, 클래스 하나를 <html>에 붙여 CSS 쪽에서
  // "prefers-reduced-motion: reduce"와 동일하게 취급하게 한다.
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const toggleSoundEffects = () => {
    setSoundEffects((prev) => {
      const next = !prev;

      window.localStorage.setItem(SOUND_EFFECTS_STORAGE_KEY, next ? "1" : "0");

      return next;
    });
  };

  const toggleReduceMotion = () => {
    setReduceMotion((prev) => {
      const next = !prev;

      window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, next ? "1" : "0");

      return next;
    });
  };

  const toggleConfirmBets = () => {
    setConfirmBets((prev) => {
      const next = !prev;

      window.localStorage.setItem(CONFIRM_BETS_STORAGE_KEY, next ? "1" : "0");

      return next;
    });
  };

  // 데스크톱에서는 채팅이 항상 보이므로 "안 읽음" 배지도 필요 없다.
  const isDesktop = useIsDesktop();

  // 소켓 리스너는 마운트 시 한 번만 등록되므로, 리스너 안에서 최신 열림
  // 상태를 읽으려면(클로저에 갇히지 않도록) ref로 따로 최신값을 유지한다.
  const isChatOpenRef = useRef(isChatOpen || isDesktop);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen || isDesktop;
  }, [isChatOpen, isDesktop]);

  // 같은 이유로, 채팅 알림음 재생 여부와 "내가 보낸 메시지인지" 판단에
  // 쓰는 playerId도 소켓 리스너 안에서는 ref로 읽는다.
  const soundEffectsRef = useRef(soundEffects);
  const playerIdRef = useRef(playerId);

  useEffect(() => {
    soundEffectsRef.current = soundEffects;
  }, [soundEffects]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [isSavingProfileName, setIsSavingProfileName] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // 로그인한 계정 — null이면 게스트. 랭킹은 로그인했을 때만 집계된다.
  const user = useAuth();

  // 프로필 페이지에서 설정한 닉네임. 없으면 구글 계정 이름으로 대체 표시한다.
  const [profileName, setProfileName] = useState<string | null>(null);

  // 로그인 계정의 지속 보유 칩(뱅크롤). 로비로 돌아올 때마다 최신값을 다시 불러온다.
  const [chips, setChips] = useState<number | null>(null);

  // 족보 선택 단계에서 아직 서버에 확정 제출하지 않은 임시 선택
  const [pendingSelection, setPendingSelection] = useState<number[]>([]);

  // 게스트가 예전에 입력해둔 닉네임이 있으면 불러온다(로그인 계정의
  // 프로필 이름이 아래 effect에서 먼저 채워졌다면 덮어쓰지 않는다).
  useEffect(() => {
    const saved = loadNickname();

    if (saved) {
      // localStorage는 서버에서 읽을 수 없어 마운트 이후에 동기화해야 한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName((prev) => prev || saved);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    getFirebaseDb().then(async (firestore) => {
      if (!firestore || cancelled) return;

      const { doc, getDoc } = await import("firebase/firestore");

      if (cancelled) return;

      try {
        const snapshot = await getDoc(
          doc(firestore, PROFILES_COLLECTION, user.uid),
        );

        if (cancelled) return;

        const profile = snapshot.data() as UserProfile | undefined;
        const name = profile?.name ?? user.displayName?.slice(0, 13) ?? null;

        setProfileName(name);
        setProfileNameDraft(name ?? "");

        if (name) {
          setDisplayName((prev) => prev || name);
        }
      } catch (err) {
        console.error("프로필을 불러오지 못했습니다:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || roomId) return;

    let cancelled = false;

    getFirebaseDb().then(async (firestore) => {
      if (!firestore || cancelled) return;

      const { doc, getDoc } = await import("firebase/firestore");

      if (cancelled) return;

      try {
        const snapshot = await getDoc(
          doc(firestore, RANKINGS_COLLECTION, user.uid),
        );

        if (cancelled) return;

        const entry = snapshot.data() as RankingEntry | undefined;

        setChips(entry?.money ?? STARTING_CHIPS);

        // 파산(0 이하)한 채로 로비에 돌아왔다면 자동으로 채워달라고 요청한다.
        // 서버가 실제로 0 이하인지 다시 확인한 뒤 지급하고 결과를 알려준다.
        if (entry && entry.money <= 0) {
          const idToken = await user.getIdToken();

          socket.emit("claim-bankruptcy-refill", { idToken });
        }
      } catch (err) {
        console.error("보유 칩을 불러오지 못했습니다:", err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, roomId]);

  const signOutOfGoogle = () => {
    getFirebaseAuth().then(async (auth) => {
      if (!auth) return;

      const { signOut } = await import("firebase/auth");

      signOut(auth).catch((err) => {
        console.error("로그아웃 실패:", err);
      });
    });

    setIsProfileOpen(false);
  };

  // 프로필 설정 패널에서 닉네임을 저장한다 — /profile 페이지와 같은 로직이다.
  const saveProfileName = () => {
    if (!user) return;

    const trimmed = profileNameDraft.trim().slice(0, 13);

    if (trimmed.length === 0) {
      setProfileError("이름을 입력해주세요.");
      return;
    }

    setIsSavingProfileName(true);
    setProfileError("");
    setProfileSaved(false);

    const profile: UserProfile = { name: trimmed, updatedAt: Date.now() };

    getFirebaseDb()
      .then(async (firestore) => {
        if (!firestore) return;

        const { doc, setDoc, updateDoc } = await import("firebase/firestore");

        await setDoc(doc(firestore, PROFILES_COLLECTION, user.uid), profile, {
          merge: true,
        });

        setProfileName(trimmed);
        setProfileNameDraft(trimmed);
        setDisplayName(trimmed);
        setProfileSaved(true);

        // 이미 랭킹에 기록이 있는 계정이면 표시 이름도 바로 갱신한다.
        // 아직 한 판도 안 한 계정은 랭킹 문서가 없어서 실패하는데, 그건 정상이라 무시한다.
        updateDoc(doc(firestore, RANKINGS_COLLECTION, user.uid), {
          name: trimmed,
        }).catch(() => {});
      })
      .catch((err) => {
        console.error("프로필 저장에 실패했습니다:", err);
        setProfileError("저장에 실패했습니다.");
      })
      .finally(() => {
        setIsSavingProfileName(false);
      });
  };

  useEffect(() => {
    socket.on("room-created", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setRoomName(info.name);
      setRoomHasPassword(info.hasPassword);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setRoomPlayers(info.players);
      setChatMessages(info.chatMessages);
      setError("");
      setIsSubmittingRoom(false);
      saveSession({
        roomId: info.roomId,
        playerId: info.playerId,
        rejoinToken: info.rejoinToken,
      });
    });

    socket.on("room-joined", (info: RoomInfo) => {
      setRoomId(info.roomId);
      setRoomName(info.name);
      setRoomHasPassword(info.hasPassword);
      setPlayerId(info.playerId);
      setPlayerCount(info.playerCount);
      setMaxPlayers(info.maxPlayers);
      setRoomPlayers(info.players);
      setChatMessages(info.chatMessages);
      setError("");
      setIsSubmittingRoom(false);
      saveSession({
        roomId: info.roomId,
        playerId: info.playerId,
        rejoinToken: info.rejoinToken,
      });
    });

    socket.on("rejoin-failed", () => {
      clearSession();
    });

    socket.on(
      "players-updated",
      ({
        count,
        maxPlayers,
        players,
      }: {
        count: number;
        maxPlayers: number;
        players: RoomPlayerInfo[];
      }) => {
        setPlayerCount(count);
        setMaxPlayers(maxPlayers);
        setRoomPlayers(players);
      },
    );

    socket.on("game-state", (state: ClientGameState) => {
      setGameState(state);
      setError("");
      setHasVotedRestart(false);
      setRestartVotes(0);
      setRestartVotesTotal(0);
      setBankruptcyNotice(null);
      setHasDecidedBankruptcy(false);

      if (state.phase !== "select") {
        setPendingSelection([]);
      }
    });

    socket.on(
      "restart-votes-updated",
      ({ votes, total }: { votes: number; total: number }) => {
        setRestartVotes(votes);
        setRestartVotesTotal(total);
      },
    );

    socket.on("bankruptcy-notice", (notice: BankruptcyNotice) => {
      setBankruptcyNotice(notice);
      setHasDecidedBankruptcy(false);
    });

    socket.on("player-left", ({ message }: { message: string }) => {
      setLeaveNotice(message);
    });

    socket.on("spectator-notice", ({ message }: { message: string }) => {
      setLeaveNotice(message);
    });

    socket.on("bankruptcy-refill-result", ({ money }: { money: number }) => {
      setChips(money);
    });

    socket.on("chat-message", (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);

      if (!isChatOpenRef.current) {
        setHasUnreadChat(true);
      }

      if (soundEffectsRef.current && message.playerId !== playerIdRef.current) {
        playChatSound();
      }
    });

    socket.on(
      "chat-typing",
      ({
        playerId: typingPlayerId,
        name,
        isTyping,
      }: {
        playerId: string;
        name: string;
        isTyping: boolean;
      }) => {
        if (typingExpiryTimers.current[typingPlayerId]) {
          window.clearTimeout(typingExpiryTimers.current[typingPlayerId]);
          delete typingExpiryTimers.current[typingPlayerId];
        }

        if (isTyping) {
          setTypingUsers((prev) => ({ ...prev, [typingPlayerId]: name }));

          typingExpiryTimers.current[typingPlayerId] = window.setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };

              delete next[typingPlayerId];

              return next;
            });
          }, 3000);
        } else {
          setTypingUsers((prev) => {
            const next = { ...prev };

            delete next[typingPlayerId];

            return next;
          });
        }
      },
    );

    socket.on("error-message", ({ message }: { message: string }) => {
      setError(message);
      setHasVotedRestart(false);
      setIsSubmittingRoom(false);
    });

    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("rejoin-failed");
      socket.off("players-updated");
      socket.off("game-state");
      socket.off("restart-votes-updated");
      socket.off("bankruptcy-notice");
      socket.off("player-left");
      socket.off("spectator-notice");
      socket.off("bankruptcy-refill-result");
      socket.off("chat-message");
      socket.off("chat-typing");
      socket.off("error-message");

      for (const timer of Object.values(typingExpiryTimers.current)) {
        window.clearTimeout(timer);
      }

      typingExpiryTimers.current = {};
    };
  }, []);

  // 내 차례가 "됐을 때"(이미 내 차례였던 상태가 계속되는 게 아니라, 막
  // 넘어온 순간)만 알림음을 울린다.
  const wasMyTurnRef = useRef(false);

  useEffect(() => {
    const isBettingPhase =
      gameState?.phase === "betting1" || gameState?.phase === "betting2";
    const isMyTurnNow =
      isBettingPhase &&
      gameState.players[gameState.currentPlayerIndex]?.id === playerId;

    if (isMyTurnNow && !wasMyTurnRef.current && soundEffects) {
      playTurnSound();
    }

    wasMyTurnRef.current = Boolean(isMyTurnNow);
  }, [gameState, playerId, soundEffects]);

  // 나감 알림은 5초 뒤 자동으로 닫힌다.
  useEffect(() => {
    if (!leaveNotice) return;

    const timer = window.setTimeout(() => setLeaveNotice(null), 5000);

    return () => window.clearTimeout(timer);
  }, [leaveNotice]);

  // 최소 인원 미달로 게임 시작에 실패했다는 안내도 5초 뒤 자동으로 닫힌다.
  useEffect(() => {
    if (error !== NOT_ENOUGH_PLAYERS_ERROR) return;

    const timer = window.setTimeout(() => setError(""), 5000);

    return () => window.clearTimeout(timer);
  }, [error]);

  // 마운트 시 이전에 있던 방이 저장돼 있으면 자동으로 재접속을 시도한다.
  //
  // 로그인 계정 자리는 서버가 idToken으로 uid까지 확인하므로, Firebase
  // 로그인 상태(user)가 아직 복구되지 않은 시점에 idToken 없이 보내면
  // 정당한 재접속도 실패한다. 로그인 상태가 이미 있으면 바로 시도하고,
  // 아직 없다면(게스트이거나 로그인 복구가 느린 경우) 잠시 기다렸다가
  // 그때 값으로 한 번만 시도한다 — 그사이 로그인이 복구되면 effect가
  // 다시 실행되면서 대기 중이던 시도는 취소되고 올바른 토큰으로 재시도된다.
  useEffect(() => {
    const session = loadSession();

    if (!session) return;

    let cancelled = false;
    let timer: number | undefined;

    const attemptRejoin = async () => {
      const idToken = user ? await user.getIdToken() : undefined;

      if (!cancelled) {
        socket.emit("rejoin-room", { ...session, idToken });
      }
    };

    if (user) {
      attemptRejoin();
    } else {
      timer = window.setTimeout(attemptRejoin, 700);
    }

    return () => {
      cancelled = true;

      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [user]);

  // 7. 방 만들기
  const createRoom = async () => {
    if (isSubmittingRoom) return;

    setError("");
    setIsSubmittingRoom(true);

    const idToken = user ? await user.getIdToken() : undefined;

    // 정원은 정하지 않고 보낸다 — 방을 만든 뒤 대기실에서 방장이 조정한다.
    socket.emit("create-room", {
      name: displayName.trim() || undefined,
      roomName: createRoomName.trim() || undefined,
      password: createPassword.trim() || undefined,
      idToken,
    });
  };

  // 9. 게임 시작
  const startGame = () => {
    if (!roomId) return;

    if (playerCount < MIN_ROOM_PLAYERS) {
      setError(NOT_ENOUGH_PLAYERS_ERROR);
      return;
    }

    socket.emit("start-game", roomId);
  };

  // 방장이 아닌 참가자가 대기실에서 준비 상태를 켜고 끈다.
  const toggleReady = () => {
    if (!roomId) return;

    socket.emit("toggle-ready", roomId);
  };

  // 대기실에서 방장이 빈자리를 AI로 채우거나 뺀다.
  const addAiPlayer = () => {
    if (!roomId) return;

    socket.emit("add-ai-player", roomId);
  };

  // 대기실에서 방장이 정원(최대 인원)을 바꾼다.
  const changeMaxPlayers = (nextMaxPlayers: number) => {
    if (!roomId) return;

    socket.emit("set-max-players", { roomId, maxPlayers: nextMaxPlayers });
  };

  const removeAiPlayer = (aiPlayerId: string) => {
    if (!roomId) return;

    socket.emit("remove-ai-player", { roomId, playerId: aiPlayerId });
  };

  // 방을 나갈 때 로컬에 남아있던 방/게임 상태를 정리한다.
  const resetRoomState = () => {
    clearSession();

    setRoomId("");
    setRoomName("");
    setRoomHasPassword(false);
    setPlayerId("");
    setGameState(null);
    setPlayerCount(0);
    setMaxPlayers(MIN_ROOM_PLAYERS);
    setRoomPlayers([]);
    setPendingSelection([]);
    setIsGuideOpen(false);
    setError("");
    setHasVotedRestart(false);
    setRestartVotes(0);
    setRestartVotesTotal(0);
    setBankruptcyNotice(null);
    setHasDecidedBankruptcy(false);
    setLeaveNotice(null);
    setChatMessages([]);
    setIsChatOpen(false);
    setHasUnreadChat(false);
    setChatInput("");
  };

  // 10. 방 나가기
  const leaveRoom = () => {
    if (!roomId) return;

    const isMidGame = !!gameState && gameState.phase !== "finished";

    if (
      isMidGame &&
      !window.confirm(
        "게임을 나가시겠습니까? 진행 중인 판은 자동으로 다이(패배) 처리되고, 이미 낸 판돈은 돌려받지 못합니다.",
      )
    ) {
      return;
    }

    socket.emit("leave-room", roomId);
    resetRoomState();
  };

  // 다시하기 투표 — 참가자 전원이 동의해야 실제로 재시작된다. AI는 항상
  // 자동으로 동의한 것으로 취급되므로, AI만 남은 상대라면 클릭 한 번으로
  // 바로 재시작된다.
  const restartGame = () => {
    if (!roomId || hasVotedRestart) return;

    setError("");
    setHasVotedRestart(true);

    socket.emit("restart-game", roomId);
  };

  // 파산했을 때 다음 판을 관전할지, 방을 나갈지 선택한다.
  const decideBankruptcy = (choice: "spectate" | "leave") => {
    if (!roomId || hasDecidedBankruptcy) return;

    setHasDecidedBankruptcy(true);
    socket.emit("bankruptcy-decision", { roomId, choice });

    if (choice === "leave") {
      resetRoomState();
    }
  };

  // 관전 중인 플레이어가 "경기 참여"를 눌러 다음 판부터 참가하겠다고 알린다.
  const joinNextRound = () => {
    if (!roomId) return;

    socket.emit("join-next-round", roomId);
  };

  // 콜/하프/쿼터/더블/올인은 실제 베팅액 변화(player.lastAction)에 맞춰
  // PlayerPanel의 칩 애니메이션 이펙트에서 소리를 재생한다 — 여기서
  // 미리 재생하면 상대방 액션과 달리 나만 두 번(클릭 시 한 번, 서버
  // 응답 반영 시 또 한 번) 울리게 된다.
  const call = () => {
    if (!roomId) return;

    socket.emit("call", roomId);
  };

  const check = () => {
    if (!roomId) return;

    if (soundEffects) {
      playSoundFile(CHIP_SOUND_PATHS.check);
    }

    socket.emit("check", roomId);
  };

  // 하프/쿼터/더블 — 베팅을 열 때든 레이즈할 때든 같은 액션이다. 추가로
  // 낼 금액(현재 팟 × 배율)은 서버가 계산한다.
  const raiseByRatio = (ratio: RaiseRatio) => {
    if (!roomId) return;

    if (
      confirmBets &&
      !confirmBetAmount(
        RAISE_RATIO_LABEL[ratio],
        gameState,
        playerId,
        (amounts) => amounts.raiseAmounts[ratio],
      )
    ) {
      return;
    }

    socket.emit("raise", { roomId, ratio });
  };

  // 올인 — 남은 칩을 전부 건다. 판당 최대 베팅 금액의 예외다. 서버가
  // 콜/레이즈 여부까지 판단하므로 클라이언트는 그냥 요청만 보낸다.
  const allIn = () => {
    if (!roomId) return;

    if (
      confirmBets &&
      !confirmBetAmount(
        "올인",
        gameState,
        playerId,
        (amounts) => amounts.allInAmount,
      )
    ) {
      return;
    }

    socket.emit("all-in", roomId);
  };

  const fold = () => {
    if (!roomId) return;

    socket.emit("fold", roomId);
  };

  const revealCard = (cardIndex: number) => {
    if (!roomId) return;

    socket.emit("reveal-card", {
      roomId,
      cardIndex,
    });
  };

  const toggleSelect = (cardIndex: number) => {
    setPendingSelection((prev) => {
      if (prev.includes(cardIndex)) {
        return prev.filter((index) => index !== cardIndex);
      }

      if (prev.length >= 2) {
        return prev;
      }

      return [...prev, cardIndex];
    });
  };

  const confirmSelect = () => {
    if (!roomId || pendingSelection.length !== 2) return;

    socket.emit("select-hand", {
      roomId,
      indices: pendingSelection,
    });
  };

  // 입력 중임을 상대에게 알린다 — 타이핑할 때마다 보내지 않고, "입력
  // 시작"과(1.5초간 추가 입력이 없는) "입력 멈춤" 시점에만 한 번씩 보낸다.
  const notifyTyping = () => {
    if (!roomId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("chat-typing", { roomId, isTyping: true });
    }

    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);

    typingStopTimer.current = window.setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("chat-typing", { roomId, isTyping: false });
    }, 1500);
  };

  const handleChatInputChange = (value: string) => {
    setChatInput(value);

    if (value.trim()) {
      notifyTyping();
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();

    if (!roomId || !text) return;

    socket.emit("chat-message", { roomId, text });
    setChatInput("");

    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("chat-typing", { roomId, isTyping: false });
    }
  };

  const openChat = () => {
    setIsChatOpen(true);
    setHasUnreadChat(false);
  };

  /*
   * 아직 방에 들어가지 않은 상태
   */
  if (!roomId) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-4 xl:flex-row">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRankingOpen(true)}
            className="rounded-lg border border-white/10 bg-white/3 px-3 py-1.5 text-[13.5px] font-medium text-zinc-300 transition hover:bg-white/10"
          >
            랭킹
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-lg border border-white/10 bg-white/3 px-3 py-1.5 text-[13.5px] font-medium text-zinc-300 transition hover:bg-white/10"
          >
            설정
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setProfileError("");
                  setProfileSaved(false);
                  setIsProfileOpen(true);
                }}
                className="text-[13.5px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                {profileName ?? user.displayName ?? "플레이어"}님
              </button>

              {user && chips !== null && (
                <span className="rounded-lg border border-gold/20 bg-gold/5 px-2.5 py-1 font-mono text-[13.5px] font-semibold tabular-nums text-gold-bright">
                  칩 {chips.toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <GoogleSignInButton onError={setError} />
          )}
        </div>

        {/* 화면이 충분히 넓을 때만 중앙 콘텐츠 양옆에 세로형 배너를 하나씩
            띄운다 — 좁은 화면에서는 AdSlot이 아예 렌더링되지 않아도
            gap만 남지 않도록 이 래퍼 자체를 숨긴다. */}
        <div className="hidden shrink-0 xl:block">
          <AdSlot
            slotId={ADSENSE_LOBBY_SIDE_SLOT_ID}
            width={160}
            height={600}
          />
        </div>

        <div className="flex w-full max-w-xl flex-col items-center">
          <h1 className="mb-3 flex flex-col items-center gap-1">
            <span className="font-serif text-[36px] font-black tracking-tight text-gold">
              섯다
            </span>{" "}
            <span className="text-[17.5px] font-normal text-zinc-500">
              친구와 온라인으로 즐기는 전통 카드 게임
            </span>
          </h1>

          <p className="mb-5 max-w-sm text-center text-[13.5px] leading-relaxed text-zinc-500">
            화투 카드로 즐기는 전통 카드 게임, 친구와 온라인에서 실시간으로
            대결해보세요.
          </p>

          <div className="mb-4 w-full max-w-sm">
            <label className="mb-1.5 block text-[13px] font-medium text-zinc-500">
              닉네임 (선택)
            </label>

            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                saveNickname(event.target.value.trim());
              }}
              placeholder="입력하지 않으면 기본 이름이 부여됩니다"
              maxLength={13}
              className="w-full rounded-xl border border-white/20 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] px-4 py-2 text-[17.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <div className="w-full max-w-xl">
            <div className="flex flex-col">
              {/* 7. 방 만들기 */}
              <section className="animate-fade-up flex w-full flex-col rounded-2xl border border-white/10 bg-white/3 p-5 shadow-xl shadow-black/30 sm:p-6">
                <h2 className="mb-1 text-[20px] font-bold">방 만들기</h2>

                <p className="mb-2 text-[15.5px] text-zinc-400">
                  새로운 게임 방을 생성합니다.
                </p>

                <input
                  value={createRoomName}
                  onChange={(event) => setCreateRoomName(event.target.value)}
                  placeholder="방 이름"
                  maxLength={20}
                  className="mb-2 w-full rounded-xl border border-white/20 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] px-4 py-2 text-[15.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />

                <input
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  placeholder="비밀번호"
                  maxLength={20}
                  className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] px-4 py-2 text-[15.5px] text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />

                <button
                  type="button"
                  onClick={createRoom}
                  disabled={isSubmittingRoom}
                  className="mt-auto w-full rounded-xl bg-gold px-6 py-3 text-[16px] font-semibold text-zinc-900 transition hover:scale-[1.02] hover:bg-gold-bright active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSubmittingRoom ? "만드는 중..." : "방 만들기"}
                </button>
              </section>

              {/* 8. 방 찾기 */}
              <Link
                href="/rooms"
                style={{ animationDelay: "80ms" }}
                className="animate-fade-up mt-2 block w-full rounded-xl border border-white/15 bg-white/3 px-6 py-3 text-center text-[16px] font-semibold text-zinc-200 transition hover:scale-[1.02] hover:border-felt/40 hover:bg-felt/10 hover:text-felt-bright active:scale-[0.98]"
              >
                방 찾기
              </Link>
            </div>

            {error && (
              <p className="animate-fade-up mt-6 rounded-xl border border-crimson/30 bg-crimson/10 p-4 text-center text-[17.5px] font-medium text-crimson-bright">
                {error}
              </p>
            )}

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="flex flex-wrap items-center justify-center gap-4 text-[14.5px] text-zinc-400">
                <Link
                  href="/about"
                  className="underline-offset-2 hover:text-zinc-200 hover:underline"
                >
                  섯다란?
                </Link>
                <span className="text-[18px] text-zinc-700">·</span>
                <Link
                  href="/rules"
                  className="underline-offset-2 hover:text-zinc-200 hover:underline"
                >
                  게임 규칙
                </Link>
                <span className="text-[18px] text-zinc-700">·</span>
                <Link
                  href="/privacy"
                  className="underline-offset-2 hover:text-zinc-200 hover:underline"
                >
                  개인정보처리방침
                </Link>
                <span className="text-[18px] text-zinc-700">·</span>
                <Link
                  href="/terms"
                  className="underline-offset-2 hover:text-zinc-200 hover:underline"
                >
                  이용약관
                </Link>
              </div>

              <p className="mt-3 text-center text-[13px] text-zinc-600">
                © {new Date().getFullYear()} 섯다
              </p>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 xl:block">
          <AdSlot
            slotId={ADSENSE_LOBBY_SIDE_SLOT_ID}
            width={160}
            height={600}
          />
        </div>

        <div className="fixed bottom-4 left-4 z-30">
          <ShareButtons />
        </div>

        <RankingModal
          open={isRankingOpen}
          onClose={() => setIsRankingOpen(false)}
        />

        {user && (
          <ProfilePanel
            open={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            email={user.email}
            name={profileNameDraft}
            onNameChange={(value) => {
              setProfileNameDraft(value);
              setProfileSaved(false);
            }}
            onSave={saveProfileName}
            saving={isSavingProfileName}
            saved={profileSaved}
            error={profileError}
            onSignOut={signOutOfGoogle}
          />
        )}

        <SettingsPanel
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          soundEffects={soundEffects}
          onToggleSoundEffects={toggleSoundEffects}
          reduceMotion={reduceMotion}
          onToggleReduceMotion={toggleReduceMotion}
          confirmBets={confirmBets}
          onToggleConfirmBets={toggleConfirmBets}
        />
      </main>
    );
  }

  return (
    <GameRoomView
      roomName={roomName}
      roomHasPassword={roomHasPassword}
      playerId={playerId}
      playerCount={playerCount}
      maxPlayers={maxPlayers}
      roomPlayers={roomPlayers}
      gameState={gameState}
      error={error}
      leaveNotice={leaveNotice}
      chatMessages={chatMessages}
      isChatOpen={isChatOpen}
      hasUnreadChat={hasUnreadChat}
      chatInput={chatInput}
      typingUsers={typingUsers}
      isGuideOpen={isGuideOpen}
      pendingSelection={pendingSelection}
      soundEffects={soundEffects}
      hasVotedRestart={hasVotedRestart}
      restartVotes={restartVotes}
      restartVotesTotal={restartVotesTotal}
      bankruptcyNotice={bankruptcyNotice}
      hasDecidedBankruptcy={hasDecidedBankruptcy}
      onAddAiPlayer={addAiPlayer}
      onRemoveAiPlayer={removeAiPlayer}
      onChangeMaxPlayers={changeMaxPlayers}
      onStartGame={startGame}
      onToggleReady={toggleReady}
      onLeaveRoom={leaveRoom}
      onOpenChat={openChat}
      onCloseChat={() => setIsChatOpen(false)}
      onOpenGuide={() => setIsGuideOpen(true)}
      onCloseGuide={() => setIsGuideOpen(false)}
      onChatInputChange={handleChatInputChange}
      onSendChat={sendChatMessage}
      onRevealCard={revealCard}
      onToggleSelect={toggleSelect}
      onConfirmSelect={confirmSelect}
      onJoinNextRound={joinNextRound}
      onDecideBankruptcy={decideBankruptcy}
      onRestartGame={restartGame}
      onCheck={check}
      onCall={call}
      onRaiseByRatio={raiseByRatio}
      onAllIn={allIn}
      onFold={fold}
    />
  );
}

