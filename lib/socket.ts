import { io, Socket } from "socket.io-client";

// 개발 모드의 Fast Refresh나 라우팅 이동으로 이 모듈이 다시 실행돼도
// 소켓 연결이 중복 생성되지 않도록 globalThis에 캐시한다. 홈 화면과
// 방 찾기 화면 등 여러 페이지가 같은 인스턴스를 공유한다.
const socketCache = globalThis as unknown as { __seotdaSocket?: Socket };

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

export const socket: Socket =
  socketCache.__seotdaSocket ??
  (socketCache.__seotdaSocket = io(SOCKET_URL, {
    // 기본값(polling으로 시작 후 websocket으로 업그레이드)은 연결마다
    // 왕복이 한 번 더 들어가 방 만들기 체감 속도를 늦춘다.
    // websocket을 먼저 시도하고, 막힌 네트워크에서만 polling으로 대체한다.
    transports: ["websocket", "polling"],
  }));
