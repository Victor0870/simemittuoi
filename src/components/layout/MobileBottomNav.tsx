"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

type MobileBottomNavProps = {
  activeHref?: string;
};

export function MobileBottomNav({ activeHref = "/" }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function checkRole(user: User | null) {
      if (cancelled) return;
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from(CDILV_TABLE.profiles)
        .select("role, approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(profile?.role === "admin" && profile?.approval_status === "approved");
    }

    void supabase.auth.getUser().then(({ data }) => checkRole(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkRole(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const current = pendingHref ?? activeHref;

  const items = isAdmin
    ? [
        ...MOBILE_NAV_ITEMS.slice(0, 3),
        { href: "/admin/scores", label: "Cộng điểm", icon: "military_tech" as const },
        MOBILE_NAV_ITEMS[3],
      ]
    : MOBILE_NAV_ITEMS;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface-container-lowest shadow-lg md:hidden">
      {items.map((item) => {
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
