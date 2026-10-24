"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminSidebar, resolveAdminLocation } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

/** Khung chung cho /admin/* và /office/*: sidebar cố định (drawer trên mobile), thanh tiêu đề, vùng nội dung. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const { group, page, isHub } = resolveAdminLocation(pathname);
  const { user, profile, isAdmin } = useAuth();
  const hubHref = group && isAdmin ? group.href : "/office";
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const initial = (profile?.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  const closeDrawer = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDrawer]);

  return (
    <div className="min-h-screen bg-surface-bg" data-admin-shell="">
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block print:hidden">
        <AdminSidebar />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[60] md:hidden print:hidden">
          <button
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/40"
            type="button"
            onClick={() => closeDrawer(true)}
          />
          <div className="relative h-full max-w-[85vw] overflow-hidden shadow-xl">
            <AdminSidebar onNavigate={() => closeDrawer()} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col md:pl-[270px] print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-dusty-border bg-white px-4 md:px-7 print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={menuButtonRef}
              aria-expanded={open}
              aria-label="Mở menu quản trị"
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden"
              type="button"
              onClick={() => setOpen(true)}
            >
              <MaterialIcon className="text-[24px]" name="menu" />
            </button>
            {group && page ? (
              <Link
                aria-label={`Quay lại ${group.label}`}
                className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-[#173A67] md:hidden"
                href={hubHref}
              >
                <MaterialIcon className="text-[20px]" name="arrow_back" />
              </Link>
            ) : null}
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm">
              <Link className="shrink-0 text-on-surface-variant hover:text-[#173A67]" href={isAdmin ? "/admin" : "/office"}>
                Quản trị
              </Link>
              <span className="shrink-0 text-outline">/</span>
              {!group || isHub ? (
                <span aria-current="page" className="min-w-0 truncate font-bold text-[#173A67]">
                  {group?.label ?? "Tổng quan"}
                </span>
              ) : (
                <>
                  <Link
                    className={`min-w-0 truncate text-on-surface-variant hover:text-[#173A67] ${page ? "max-w-[9rem] sm:max-w-[14rem] md:max-w-none" : ""}`}
                    href={hubHref}
                  >
                    {group.label}
                  </Link>
                  {page ? (
                    <>
                      <span className="shrink-0 text-outline">/</span>
                      <span aria-current="page" className="min-w-0 truncate font-bold text-[#173A67]">
                        {page.label}
                      </span>
                    </>
                  ) : null}
                </>
              )}
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

        <main className="mx-auto w-full min-w-0 max-w-container-max flex-1 p-6 md:p-7 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
