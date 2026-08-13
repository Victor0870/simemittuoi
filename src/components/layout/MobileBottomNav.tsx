"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";

type MobileBottomNavProps = {
  activeHref?: string;
};

export function MobileBottomNav({ activeHref = "/" }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const current = pendingHref ?? activeHref;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface-container-lowest shadow-lg md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = item.href === current;

        return (
          <Link
            key={item.href}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 transition-colors ${
              isActive
                ? "bg-tertiary-container text-on-tertiary-container"
                : "text-on-surface-variant"
            } ${pendingHref === item.href ? "opacity-80" : ""}`}
            href={item.href}
            prefetch
            onClick={() => {
              if (item.href === pathname) return;
              setPendingHref(item.href);
              startTransition(() => undefined);
            }}
          >
            <MaterialIcon filled={isActive} name={item.icon} />
            <span className={`text-[10px] ${isActive ? "font-bold" : ""}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
