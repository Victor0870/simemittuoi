"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const EXEMPT = new Set(["/login", "/register", "/pending"]);
const CACHE_KEY = "smm_approval_ok";

/**
 * Chặn trường hợp xác nhận email / session vào trang chính trước khi duyệt.
 * Đã duyệt: cache session để không gọi API lại mỗi lần đổi trang (giảm lag mobile).
 */
export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const checkedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (pathname.startsWith("/auth/")) return;

      try {
        if (sessionStorage.getItem(CACHE_KEY) === "1" && checkedRef.current) {
          return;
        }
      } catch {
        // ignore
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        try {
          sessionStorage.removeItem(CACHE_KEY);
        } catch {
          // ignore
        }
        checkedRef.current = true;
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status, role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const status = profile?.approval_status ?? "pending";
      checkedRef.current = true;

      if (status !== "approved") {
        try {
          sessionStorage.removeItem(CACHE_KEY);
        } catch {
          // ignore
        }
        if (!EXEMPT.has(pathname)) {
          router.replace(
            status === "rejected" ? "/pending?status=rejected" : "/pending",
          );
        }
        return;
      }

      try {
        sessionStorage.setItem(CACHE_KEY, "1");
      } catch {
        // ignore
      }

      if (EXEMPT.has(pathname)) {
        router.replace(profile?.role === "admin" ? "/admin/users" : "/");
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <>{children}</>;
}
