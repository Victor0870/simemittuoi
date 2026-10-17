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
        <div className="flex min-h-screen flex-col bg-surface-bg text-on-surface">
          <TopNav activeHref={activeHref} />
          <main className="mx-auto w-full max-w-container-max flex-grow px-margin-mobile pt-20 pb-24 md:pt-24 md:pb-12 md:px-margin-desktop">
            {children}
          </main>
          <Footer />
          <MobileBottomNav activeHref={activeHref} />
          <QuizEventPopup />
        </div>
      </ApprovalGate>
    </AuthProvider>
  );
}
