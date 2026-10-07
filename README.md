<div align="center">

# 🎴 섯다 (Seotda)

**친구와 온라인으로 즐기는 전통 섯다 카드 게임**

방을 만들어 초대 링크로 모이면, 베팅부터 카드 공개, 족보 판정까지 실시간으로 진행됩니다.
사람이 모자라면 AI를 채워 혼자서도 대전할 수 있어요.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## ✨ 주요 기능

### 🃏 게임
- **베팅 7종** — 체크 · 콜 · 하프 · 쿼터 · 더블 · 올인 · 다이
- **족보 판정** — 땡, 알리, 광땡, 암행어사 같은 특수 족보와 재경기 처리
- **사이드 팟** — 올인이 섞여도 팟을 정확히 나눠 분배
- **효과음** — 베팅 종류마다 다른 소리

### 🚪 방과 접속
- **방 시스템** — 비밀번호 방, 초대 링크, 로비에서 진행 중인 방도 항상 노출
- **관전** — 정원이 차면 관전하다가 다음 판부터 참가
- **재접속 복구** — 새로고침이나 네트워크 끊김 후에도 토큰으로 자리와 비공개 카드를 그대로 복구
- **채팅** — 방별 채팅, 입력 중 표시, 도배 방지 레이트 리밋

### 🤖 AI 플레이어
- 방장이 부족한 인원을 AI로 채움 (난이도 easy / normal / hard)
- 승률 계산과 베팅 결정은 수학적 계산, **블러핑 여부만 Groq LLM**이 판단
- 키가 없거나 호출이 실패하면 내장 블러핑 로직으로 자동 대체

### 👤 계정과 랭킹
- **소셜 로그인** — Google · 네이버 · 카카오 · GitHub (한 계정에 최대 4개 연동)
- 닉네임과 보유 칩을 Firestore에 저장, 승수/승률 랭킹 (AI가 낀 방은 제외)
- 게스트 플레이 가능 (로그인 없이)

### 📄 콘텐츠
- 규칙 안내, 족보 가이드, 소개, 이용약관, 개인정보처리방침
- SEO: sitemap, robots, OG 이미지, 구조화 데이터

---

## 🛠 기술 스택

| 영역 | 구성 |
|---|---|
| 프론트엔드 | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4 |
| 실시간 통신 | Socket.IO (클라이언트 + 별도 Node 서버) |
| 인증 / DB | Firebase Auth, Firestore, Firebase Admin SDK |
| AI | 자체 확률 기반 AI + Groq (블러핑 판단 전용) |
| 배포 | Next.js 앱 → Vercel, 소켓 서버 → Render 등 상시 구동 Node 호스팅 |
| 테스트 | Node 내장 테스트 러너 (`node:test`) + `tsx` |

---

## 🏗 구조

```
app/                  Next.js 페이지 (로비, 방, 게임 화면, 가이드, 약관 등)
  api/auth/           소셜 로그인 (Google 토큰 검증, 네이버·카카오·GitHub OAuth)
  components/         GameRoomView, RankingModal, ShareButtons 등
server/socket.ts      게임 서버 (방 관리, 소켓 이벤트, Firestore 랭킹 동기화)
lib/seotda/           게임 규칙 엔진 (서버·UI와 분리)
lib/auth/             OAuth, 계정 연동, 세션
lib/firebase/         Firebase client / Admin SDK 초기화
types/                클라이언트-서버 공유 타입
tests/                규칙 엔진과 AI 테스트
firestore.rules       Firestore 보안 규칙
```

**규칙 엔진 (`lib/seotda/`)**

| 모듈 | 역할 |
|---|---|
| `game.ts` | 카드 배분, 단계 전이, 정산 조율 |
| `bettingRound.ts` | 베팅 라운드 |
| `potManager.ts` | 팟 / 사이드 팟 분배 |
| `rematchResolver.ts` | 재경기 판정 |
| `ranking.ts` | 족보 평가 |
| `ai.ts` · `llmAi.ts` | AI 의사결정 / Groq 블러핑 |

**설계 포인트**
- 게임 상태는 **서버가 단독으로 관리**하고, 상대 카드는 본인에게만 전송합니다. 관전자용 뷰도 따로 있습니다.
- 규칙 엔진이 서버·UI와 분리돼 있어 단독으로 테스트할 수 있습니다.
- Firebase 설정이 없으면 로그인과 랭킹만 꺼지고 나머지는 그대로 동작합니다.

---

## 🚀 로컬에서 실행하기

**Next.js 앱**과 **Socket.IO 게임 서버**, 두 프로세스를 각각 띄워야 합니다. Node 24.x가 필요합니다.

```bash
npm install

# 터미널 1: Next.js 앱 (포트 3000)
npm run dev

# 터미널 2: 게임 서버 (포트 3001)
npm run socket
```

`http://localhost:3000`에서 확인할 수 있습니다. Firebase 환경변수 없이도 게스트 플레이는 정상 동작합니다.

### 테스트

```bash
npx tsx --test tests/*.test.ts
```

무작위 시드 시뮬레이션으로 "어떤 진행이든 판이 끝나면 칩 총합이 보존되고 음수 칩이 없다"를 검증하고, AI·블러핑·재경기 규칙도 함께 확인합니다.

---

## 🔐 환경 변수

`.env.example`을 복사해 `.env.local`로 만들고 필요한 값만 채웁니다.

```bash
cp .env.example .env.local
```

| 구분 | 변수 | 설명 |
|---|---|---|
| 필수 | `NEXT_PUBLIC_SOCKET_URL` | 앱이 접속할 소켓 서버 주소 |
| 필수 | `CLIENT_URL` | 소켓 서버가 CORS로 허용할 프론트엔드 주소 |
| Firebase | `NEXT_PUBLIC_FIREBASE_*` | 클라이언트 설정 (API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID) |
| Firebase | `FIREBASE_PROJECT_ID` / `CLIENT_EMAIL` / `PRIVATE_KEY` | 서버(Admin SDK)용 서비스 계정 키 |
| 로그인 | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google 로그인 OAuth 클라이언트 ID |
| 로그인 | `GITHUB_*` · `NAVER_*` · `KAKAO_*` | 각 소셜 로그인의 클라이언트 ID / 시크릿 |
| AI | `GROQ_API_KEY` · `GROQ_MODEL` | 블러핑 판단용 (선택, 소켓 서버에만 설정) |
| 선택 | `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오톡 공유 버튼 (없으면 버튼 숨김) |
| 선택 | `NEXT_PUBLIC_ADSENSE_*` | 구글 애드센스 (없으면 광고 영역 미표시) |

소셜 로그인 콜백 URL은 `https://<도메인>/api/auth/{github|naver|kakao}/callback` 형식입니다.

---

## 📦 배포

| 대상 | 방법 |
|---|---|
| Next.js 앱 | Vercel에 그대로 배포 (`npm run build` / `npm run start`) |
| 소켓 서버 | `npm run socket`을 상시 구동할 수 있는 Node 호스팅(Render 등). `CLIENT_URL`에 실제 프론트엔드 도메인을 반드시 설정해야 CORS가 열립니다. |
| Firestore 규칙 | `firebase deploy --only firestore:rules` |

---

## 📜 라이선스

[MIT](LICENSE)
