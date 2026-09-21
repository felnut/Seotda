// 알림음은 채팅/차례/베팅 같은 소켓 이벤트·이펙트에서 비동기로 울리는데,
// 이때마다 새 AudioContext를 만들면 브라우저 자동재생 정책 때문에 그
// context가 suspended 상태로 태어나 소리가 전혀 안 나면서도 예외조차
// 던지지 않는다(조용히 실패). 페이지당 하나의 context를 만들어 재사용하고
// 필요할 때마다 resume()해야 실제로 소리가 난다.
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return null;

  sharedAudioContext = new AudioContextCtor();
  return sharedAudioContext;
}

// 짧은 알림음 하나를 재생한다. 별도 음원 파일 없이 Web Audio API로 톤을
// 직접 만든다 — 브라우저가 자동재생을 막아 실패하더라도(사용자 상호작용
// 이전 등) 게임 진행에는 영향이 없어야 하므로 예외는 조용히 무시한다.
function playBeep(frequency: number, durationMs: number): void {
  try {
    const ctx = getSharedAudioContext();

    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + durationMs / 1000,
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // 오디오가 막힌 환경(자동재생 차단 등)은 그냥 무음으로 넘어간다.
  }
}

// 내 차례를 알리는 두 음(높은음이 뒤따라오는 짧은 차임)
export function playTurnSound(): void {
  playBeep(660, 120);
  window.setTimeout(() => playBeep(880, 140), 110);
}

export function playChatSound(): void {
  playBeep(520, 90);
}

// public/sounds에 저장해둔 실제 음원. 액션마다 다른 느낌의 소리가 나도록
// 미리 녹음/제작된 파일을 쓴다 — 합성음(playBeep)과 달리 이쪽은 브라우저의
// 오디오 자동재생 제한을 받지 않는 한 즉시 재생된다(버튼 클릭이라는 사용자
// 제스처 안에서 바로 호출되기 때문).
export const CHIP_SOUND_PATHS = {
  check: "/sounds/check.mp3",
  call: "/sounds/call.mp3",
  halfQuarter: "/sounds/half-quarter.mp3",
  double: "/sounds/double.mp3",
  allIn: ["/sounds/allin1.mp3", "/sounds/allin2.mp3"],
} as const;

// 같은 음원이 짧은 간격으로 겹쳐 재생될 수 있어(예: 내 콜 직후 곧바로
// 상대가 베팅) 매번 clone해서 재생한다 — 안 그러면 나중 재생이 앞선
// 재생을 currentTime 리셋으로 끊어버린다. 디코딩된 오디오 데이터 자체는
// origin 오디오 엘리먼트에 캐시돼 재사용된다.
const soundElementCache = new Map<string, HTMLAudioElement>();

export function playSoundFile(src: string, volume = 0.55): void {
  try {
    let base = soundElementCache.get(src);

    if (!base) {
      base = new Audio(src);
      soundElementCache.set(src, base);
    }

    const instance = base.cloneNode(true) as HTMLAudioElement;
    instance.volume = volume;
    void instance.play().catch(() => {
      // 자동재생이 막힌 환경은 조용히 무시한다.
    });
  } catch {
    // 오디오 로드/재생 실패는 게임 진행에 영향을 주지 않는다.
  }
}

export function playAllInSound(): void {
  const [a, b] = CHIP_SOUND_PATHS.allIn;
  playSoundFile(Math.random() < 0.5 ? a : b);
}

// 베팅액이 늘어난 원인(player.lastAction, 예: "하프 100"·"콜"·"올인 9,900")에
// 맞는 음원을 고른다. 클릭한 사람뿐 아니라 상대가 베팅했을 때도 서버가
// 내려준 lastAction으로 정확히 같은 소리를 재생할 수 있어, 버튼 클릭
// 시점이 아니라 베팅액이 실제로 반영되는 이 시점 하나에서만 재생한다.
export function playBetActionSound(lastAction: string | null): void {
  if (!lastAction) return;

  if (lastAction.startsWith("콜")) {
    playSoundFile(CHIP_SOUND_PATHS.call);
  } else if (lastAction.startsWith("더블")) {
    playSoundFile(CHIP_SOUND_PATHS.double);
  } else if (lastAction.startsWith("하프") || lastAction.startsWith("쿼터")) {
    playSoundFile(CHIP_SOUND_PATHS.halfQuarter);
  } else if (lastAction.startsWith("올인")) {
    playAllInSound();
  }
}
