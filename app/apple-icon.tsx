import { ImageResponse } from "next/og";

// iOS 홈 화면에 추가했을 때 쓰일 아이콘 — 별도 이미지 파일 없이
// opengraph-image.tsx와 같은 브랜드 색상으로 그때그때 생성한다.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14231a 0%, #0d1712 100%)",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "#dba95a",
            letterSpacing: -2,
          }}
        >
          섯
        </div>
      </div>
    ),
    size,
  );
}
