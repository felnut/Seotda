# 섯다

친구와 온라인으로 즐기는 전통 섯다 카드 게임. 방을 만들어 초대 링크로 모이고, 실시간으로 베팅·카드 공개·족보 판정까지 진행합니다.

## 주요 기능

- **실시간 대전** — Socket.IO 기반으로 베팅(체크/콜/하프/쿼터/더블/올인/다이), 카드 공개, 족보 선택, 쇼다운을 실시간 동기화
- **방 시스템** — 비밀번호가 있는 방 생성, 로비에서 진행 중인 방도 항상 노출, 정원 초과 시 관전 후 다음 판부터 참가
- **AI 플레이어** — 인원이 부족할 때 방장이 AI를 채워 혼자서도 대전 가능
- **로그인/랭킹** — Google 로그인 시 닉네임과 보유 칩(뱅크롤)이 Firestore에 저장되고, 승수/승률 랭킹이 기록됨 (AI가 낀 방은 랭킹에 반영되지 않음)
- **재접속 복구** — 새로고침·네트워크 끊김 후에도 토큰 기반으로 자기 좌석과 비공개 카드를 그대로 복구
- **채팅** — 방별 채팅, 입력 중 표시, 도배 방지 레이트 리밋

## 기술 스택

| 영역 | 구성 |
|---|---|
| 프론트엔드 | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4 |
| 실시간 통신 | Socket.IO (client + 별도 Node 서버) |
| 인증/DB | Firebase Auth(Google 로그인), Firestore(랭킹/프로필) |
| 배포 | Next.js 앱 → Vercel, 소켓 서버 → Render 등 상시 구동 Node 호스팅 |

## 폴더 구조

```
app/                 Next.js 페이지 (로비, 방, 게임 화면 — 전부 클라이언트 컴포넌트)
server/socket.ts     게임 서버 (방 관리, 소켓 이벤트, Firestore 랭킹 동기화)
lib/seotda/          게임 규칙 엔진 (베팅 라운드, 팟 분배, 족보 판정, 재경기, AI 의사결정)
lib/firebase/        Firebase client SDK / Admin SDK 초기화
types/                클라이언트-서버 공유 타입
firestore.rules      Firestore 보안 규칙
```

게임 로직(`lib/seotda/game.ts`)이 카드 배분·단계 전이·정산을 조율하고, 베팅 라운드(`bettingRound.ts`)·팟 분배(`potManager.ts`)·재경기 판정(`rematchResolver.ts`)은 각각 전담 모듈로 분리돼 있습니다.

## 로컬에서 실행하기

이 프로젝트는 **Next.js 앱**과 **Socket.IO 게임 서버**, 두 프로세스를 각각 띄워야 합니다.

```bash
npm install

# 터미널 1: Next.js 앱 (기본 포트 3000)
npm run dev

# 터미널 2: 게임 서버 (기본 포트 3001)
npm run socket
```

`http://localhost:3000`에서 앱을 확인할 수 있습니다. Firebase 관련 환경변수를 설정하지 않아도 게스트 플레이(로그인/랭킹 없이)는 정상 동작합니다.

## 환경 변수

`.env.example`을 복사해 `.env.local`로 만들고 필요한 값을 채웁니다.

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | Next.js 앱이 접속할 소켓 서버 주소 |
| `CLIENT_URL` | 소켓 서버가 CORS로 허용할 프론트엔드 주소 |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 클라이언트 설정 (콘솔 > 프로젝트 설정 > 웹 앱) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google 로그인용 OAuth 클라이언트 ID |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | 소켓 서버(Admin SDK)용 서비스 계정 키 |

Firebase 관련 변수가 없으면 로그인/랭킹 기능만 비활성화되고 나머지는 그대로 동작합니다.

## 배포

- **Next.js 앱**: Vercel에 그대로 배포 (`npm run build` / `npm run start`)
- **소켓 서버**: `npm run socket`을 상시 구동할 수 있는 Node 호스팅(Render 등)에 배포. `CLIENT_URL`을 실제 프론트엔드 도메인으로 반드시 설정해야 CORS가 열립니다.
- **Firestore 규칙**: `firebase deploy --only firestore:rules`

## 라이선스

[MIT](LICENSE)
