"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar } from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

export function TopNavAuth() {
  const { user, profile, loading, isGuest, isAdmin, hasAnyPermission } = useAuth();

  if (loading) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-surface-container" />
    );
  }

  if (isGuest) {
    return (
      <div className="flex items-center gap-2">
        <Link
          className="rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
          href="/login"
        >
          Đăng nhập
        </Link>
        <Link
          className="hidden rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-dusty-dark sm:inline-flex"
          href="/register"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const initial = (profile?.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <>
      {isAdmin ? (
        <Link
          className="hidden items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100 sm:inline-flex"
          href="/admin"
          title="Trang quản trị"
        >
          <MaterialIcon className="text-[15px] text-amber-600" name="shield" />
          <span>Admin</span>
        </Link>
      ) : hasAnyPermission ? (
        <Link
          className="hidden items-center gap-1 rounded-full border border-[#173A67]/30 bg-[#D9F2EC] px-2.5 py-1 text-xs font-bold text-[#173A67] transition hover:bg-[#c6eae1] sm:inline-flex"
          href="/admin"
          title="Trang quản trị"
        >
          <MaterialIcon className="text-[15px]" name="admin_panel_settings" />
          <span>Trang quản trị</span>
        </Link>
      ) : null}
      <NotificationBell />
      <Link
        aria-label={isAdmin ? "Trang quản trị" : "Cài đặt hồ sơ"}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-dusty-light font-bold text-primary transition hover:opacity-90"
        href={isAdmin ? "/admin" : "/settings"}
        title={isAdmin ? "Trang quản trị" : "Cài đặt / Avatar"}
      >
        <Avatar alt="Ảnh đại diện" fallback={initial} size={32} src={profile?.avatar_url} />
      </Link>
    </>
  );
}
