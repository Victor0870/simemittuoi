"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const EXEMPT = new Set(["/login", "/register", "/pending"]);

export function ApprovalGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isApproved, loading } = useAuth();

  useEffect(() => {
    if (loading || pathname.startsWith("/auth/")) return;

    if (!user) return;

    if (isApproved) {
      if (EXEMPT.has(pathname)) {
        router.replace("/");
      }
      return;
    }

    // Chỉ chuyển sang /pending khi biết chắc chắn chưa duyệt (hồ sơ có giá trị và không phải approved)
    if (profile && profile.approval_status !== "approved") {
      if (!EXEMPT.has(pathname)) {
        router.replace(
          profile.approval_status === "rejected" ? "/pending?status=rejected" : "/pending",
        );
      }
    }
  }, [loading, user, profile, isApproved, pathname, router]);

  return <>{children}</>;
}
