import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 완료 - 섯다",
  robots: { index: false },
  alternates: { canonical: null },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
