"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuth } from "@/components/auth/AuthProvider";

export function TopNavAuth() {
  const { user, profile, loading, isGuest, isAdmin } = useAuth();

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
      ) : null}
      <button
        aria-label="Thông báo"
        className="cursor-pointer rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
        type="button"
      >
        <MaterialIcon name="notifications" />
      </button>
      <Link
        aria-label={isAdmin ? "Trang quản trị" : "Cài đặt hồ sơ"}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-dusty-light font-bold text-primary transition hover:opacity-90"
        href={isAdmin ? "/admin" : "/settings"}
        title={isAdmin ? "Trang quản trị" : "Cài đặt / Avatar"}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Ảnh đại diện"
            className="h-full w-full object-cover"
            src={profile.avatar_url}
          />
        ) : (
          initial
        )}
      </Link>
    </>
  );
}
