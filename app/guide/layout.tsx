import { SiteMenu } from "@/app/components/SiteMenu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <SiteMenu />
      {children}
    </div>
  );
}
