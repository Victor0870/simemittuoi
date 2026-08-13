import type { ReactNode } from "react";
import { ApprovalGate } from "@/components/auth/ApprovalGate";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TopNav } from "@/components/layout/TopNav";

type AppShellProps = {
  children: ReactNode;
  activeHref?: string;
};

export function AppShell({ children, activeHref = "/" }: AppShellProps) {
  return (
    <ApprovalGate>
      <div className="min-h-screen bg-surface text-on-surface">
        <TopNav activeHref={activeHref} />
        <main className="min-h-screen px-margin-mobile pt-24 pb-16 md:px-margin-desktop">
          <div className="mx-auto max-w-container-max">{children}</div>
        </main>
        <Footer />
        <MobileBottomNav activeHref={activeHref} />
      </div>
    </ApprovalGate>
  );
}
