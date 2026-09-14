import type { NextConfig } from "next";

// Strict-Transport-Security는 Vercel이 커스텀 도메인에 자동으로 붙여주므로
// 여기서 중복 설정하지 않는다(직접 설정하면 헤더가 두 번 내려가 오히려
// 스캐너가 헷갈릴 수 있다). Content-Security-Policy는 Google 로그인
// 스크립트·Firebase·Socket.IO(wss)·Vercel Analytics가 얽혀 있어서, 잘못된
// 지시문 하나로 로그인/실시간 연결이 조용히 막힐 수 있다 — 로컬에서
// 하나씩 검증하면서 별도로 추가할 예정이라 여기서는 제외했다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // RFC 9116은 /.well-known/security.txt를 정식 위치로 두지만,
        // 루트 경로만 확인하는 스캐너/도구도 있어 리다이렉트를 열어둔다.
        source: "/security.txt",
        destination: "/.well-known/security.txt",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
