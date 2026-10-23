import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 링크 공유(카카오톡/디스코드/트위터 등) 시 미리보기에 쓰일 OG 이미지를
// 별도 이미지 파일 없이 앱 브랜드 색상(gold/felt)으로 그때그때 생성한다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // 이 이미지에 쓰는 글자만 포함한 Noto Sans CJK KR 서브셋.
  const font = await readFile(join(process.cwd(), "app/fonts/og-korean.otf"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f2eb",
        fontFamily: "Noto Sans KR",
      }}
    >
      <div
        style={{
          fontSize: 220,
          fontWeight: 400,
          color: "#a9352b",
          letterSpacing: -4,
        }}
      >
        섯다
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 40,
          color: "#272522",
        }}
      >
        친구 모이면, 섯다 한 판.
      </div>
    </div>,
    { ...size, fonts: [{ name: "Noto Sans KR", data: font, weight: 400 }] },
  );
}
