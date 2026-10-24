"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AdminSidebar, findAdminNavGroup } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

/** Khung chung cho /admin/* và /office/*: sidebar cố định (drawer trên mobile), thanh tiêu đề, vùng nội dung. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const group = findAdminNavGroup(pathname);
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (profile?.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-surface-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block print:hidden">
        <AdminSidebar />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[60] md:hidden print:hidden">
          <button
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/40"
            type="button"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full max-w-[85vw] overflow-hidden shadow-xl">
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col md:pl-[270px] print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-dusty-border bg-white px-4 md:px-7 print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Mở menu quản trị"
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden"
              type="button"
              onClick={() => setOpen(true)}
            >
              <MaterialIcon className="text-[24px]" name="menu" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm">
              <Link className="text-on-surface-variant hover:text-[#173A67]" href="/admin">
                Quản trị
              </Link>
              <span className="text-outline">/</span>
              <span className="truncate font-bold text-[#173A67]">{group?.label ?? "Tổng quan"}</span>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <Link
              aria-label="Cài đặt tài khoản"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-dusty-light font-bold text-primary transition hover:opacity-90"
              href="/settings"
              title="Cài đặt / Avatar"
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={profile.avatar_url} />
              ) : (
                initial
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-container-max flex-1 p-6 md:p-7 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
