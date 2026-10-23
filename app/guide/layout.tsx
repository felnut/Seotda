import { SiteHeader } from "@/app/components/SiteHeader";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
