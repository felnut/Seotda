import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "로그인 - 섯다",
  description: "구글, 깃허브, 네이버, 카카오 계정으로 섯다에 로그인하세요.",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <LoginClient initialError={error} />;
}
