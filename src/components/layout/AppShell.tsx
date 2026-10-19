"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApprovalGate } from "@/components/auth/ApprovalGate";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TopNav } from "@/components/layout/TopNav";
import { QuizEventPopup } from "@/components/quiz/QuizEventPopup";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";

function resolveActiveHref(pathname: string): string {
  const candidates = [
    ...NAV_ITEMS.map((item) => item.href),
    ...MOBILE_NAV_ITEMS.map((item) => item.href),
    "/posts",
    "/polls",
    "/albums",
    "/life-events",
    "/quiz",
    "/settings",
    "/score-history",
    "/campaigns",
    "/login",
    "/register",
    "/pending",
    "/admin/users",
    "/admin/employees",
    "/admin/scores",
    "/admin/polls",
    "/admin/quiz",
    "/admin/roles",
    "/office",
    "/profile",
  ];

  const unique = [...new Set(candidates)];
  const exact = unique.find((href) => href === pathname);
  if (exact) return exact;

  const prefix = unique
    .filter((href) => href !== "/" && pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return prefix ?? pathname;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const activeHref = resolveActiveHref(pathname);

  return (
    <AuthProvider>
      <ApprovalGate>
        <div className="flex min-h-screen flex-col bg-surface-bg text-on-surface print:min-h-0 print:bg-white">
          <div className="print:hidden">
            <TopNav activeHref={activeHref} />
          </div>
          <main className="mx-auto w-full max-w-container-max flex-grow px-margin-mobile pt-20 pb-24 md:pt-24 md:pb-12 md:px-margin-desktop print:max-w-none print:p-0">
            {children}
          </main>
          <div className="print:hidden">
            <Footer />
            <MobileBottomNav activeHref={activeHref} />
            <QuizEventPopup />
          </div>
        </div>
      </ApprovalGate>
    </AuthProvider>
  );
}
