import { SiteMenu } from "@/app/components/SiteMenu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <SiteMenu />
      {children}
    </div>
  );
}
