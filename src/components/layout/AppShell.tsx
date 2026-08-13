"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApprovalGate } from "@/components/auth/ApprovalGate";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TopNav } from "@/components/layout/TopNav";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";

function resolveActiveHref(pathname: string): string {
  const candidates = [
    ...NAV_ITEMS.map((item) => item.href),
    ...MOBILE_NAV_ITEMS.map((item) => item.href),
    "/settings",
    "/score-history",
    "/campaigns",
    "/login",
    "/register",
    "/pending",
    "/admin/users",
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
