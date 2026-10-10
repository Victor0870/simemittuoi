"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";

type MobileBottomNavProps = {
  activeHref?: string;
};

export function MobileBottomNav({ activeHref = "/" }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { isAdmin } = useAuth();

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const current = pendingHref ?? activeHref;

  const items = isAdmin
    ? [
        ...MOBILE_NAV_ITEMS,
        { href: "/admin", label: "Tài khoản", icon: "admin_panel_settings" as const },
      ]
    : [
        ...MOBILE_NAV_ITEMS,
        { href: "/settings", label: "Tài khoản", icon: "person" as const },
      ];

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant/70 bg-white/95 backdrop-blur-md px-1 shadow-[0_-3px_12px_rgba(0,0,0,0.06)] md:hidden">
      {items.map((item) => {
        const isActive =
          item.href === current ||
          (item.href === "/admin" && pathname.startsWith("/admin"));

        return (
          <Link
            key={item.href}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all ${
              isActive ? "text-[#173A67]" : "text-slate-500 hover:text-slate-700"
            } ${pendingHref === item.href ? "opacity-70 scale-95" : ""}`}
            href={item.href}
            prefetch
            onClick={() => {
              if (item.href === pathname) return;
              setPendingHref(item.href);
              startTransition(() => undefined);
            }}
          >
            <div
              className={`flex items-center justify-center rounded-full px-3 py-0.5 transition-all ${
                isActive ? "bg-amber-100 text-amber-900" : ""
              }`}
            >
              <MaterialIcon className="text-[21px]" filled={isActive} name={item.icon} />
            </div>
            <span
              className={`text-[10px] tracking-tight mt-0.5 ${
                isActive ? "font-extrabold text-[#173A67]" : "font-medium text-slate-600"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
