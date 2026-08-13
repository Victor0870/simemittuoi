"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const EXEMPT = new Set(["/login", "/register", "/pending"]);

/**
 * Chặn trường hợp xác nhận email / session hash vào trang chủ
 * trước khi middleware kịp kiểm tra approval_status.
 */
export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (pathname.startsWith("/auth/")) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status, role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const status = profile?.approval_status ?? "pending";

      if (status !== "approved") {
        if (!EXEMPT.has(pathname)) {
          router.replace(
            status === "rejected" ? "/pending?status=rejected" : "/pending",
          );
        }
        return;
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
