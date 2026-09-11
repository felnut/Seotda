import { ImageResponse } from "next/og";

// 링크 공유(카카오톡/디스코드/트위터 등) 시 미리보기에 쓰일 OG 이미지를
// 별도 이미지 파일 없이 앱 브랜드 색상(gold/felt)으로 그때그때 생성한다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14231a 0%, #0d1712 100%)",
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 900,
            color: "#dba95a",
            letterSpacing: -4,
          }}
        >
          섯다
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 40,
            color: "#63b381",
          }}
        >
          친구와 온라인으로 즐기는 전통 카드 게임
        </div>
      </div>
    ),
    size,
  );
}
