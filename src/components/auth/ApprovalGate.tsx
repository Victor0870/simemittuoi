"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const EXEMPT = new Set(["/login", "/register", "/pending"]);

export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading || pathname.startsWith("/auth/")) return;

    if (!user) return;

    const status = profile?.approval_status ?? "pending";
    if (status !== "approved") {
      if (!EXEMPT.has(pathname)) {
        router.replace(
          status === "rejected" ? "/pending?status=rejected" : "/pending",
        );
      }
    } else if (EXEMPT.has(pathname)) {
      router.replace("/");
    }
  }, [loading, user, profile, pathname, router]);

  return <>{children}</>;
}
