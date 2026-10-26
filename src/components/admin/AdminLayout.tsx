"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AdminTrailContext, type AdminTrail } from "@/components/admin/AdminBreadcrumbTrail";
import { AdminSidebar, resolveAdminLocation } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar } from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Khung chung cho /admin/*: sidebar cố định (drawer trên mobile), thanh tiêu đề, vùng nội dung. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const { group, page, subpage, isHub } = resolveAdminLocation(pathname);
  const { user, profile, canOpenAdmin } = useAuth();
  const [trail, setTrail] = useState<AdminTrail | null>(null);
  const extra = page && trail?.pathname === pathname ? trail.items : [];
  const hubHref = group && canOpenAdmin(group.href) ? group.href : "/admin";
  const detailLabel =
    page && !subpage && pathname !== page.href ? (pathname.endsWith("/new") ? "Tạo mới" : "Chi tiết") : null;
  const parent =
    extra.length > 1 ? extra[extra.length - 2] : extra.length === 1 || subpage || detailLabel ? page : null;
  const backHref = parent?.href ?? hubHref;
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const initial = (profile?.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  const closeDrawer = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  // Link không prefetch nên loading.tsx chỉ hiện khi máy chủ đã phản hồi; hiện khung chờ ngay khi bấm
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);
  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => setPendingPath(null), 8000);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === pathname) return;
      if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return;
      setPendingPath(url.pathname);
    },
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDrawer]);

  return (
    <div className="min-h-screen bg-surface-bg" data-admin-shell="" onClickCapture={onClickCapture}>
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
                prefetch={false}
                aria-label={`Quay lại ${parent?.label ?? group.label}`}
                className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-[#173A67] md:hidden"
                href={backHref}
              >
                <MaterialIcon className="text-[20px]" name="arrow_back" />
              </Link>
            ) : null}
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm">
              <Link prefetch={false} className="shrink-0 text-on-surface-variant hover:text-[#173A67]" href="/admin">
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
                    prefetch={false}
                    className={`min-w-0 truncate text-on-surface-variant hover:text-[#173A67] ${page ? "max-w-[9rem] sm:max-w-[14rem] md:max-w-none" : ""}`}
                    href={hubHref}
                  >
                    {group.label}
                  </Link>
                  {page && extra.length > 0 ? (
                    <>
                      <span className="shrink-0 text-outline">/</span>
                      <Link
                        prefetch={false}
                        className="min-w-0 max-w-[6rem] truncate text-on-surface-variant hover:text-[#173A67] sm:max-w-[12rem] md:max-w-none"
                        href={page.href}
                      >
                        {page.label}
                      </Link>
                      {extra.map((crumb, i) => {
                        const isLast = i === extra.length - 1;
                        return (
                          <Fragment key={crumb.href}>
                            <span className="shrink-0 text-outline">/</span>
                            <Link
                              prefetch={false}
                              aria-current={isLast ? "page" : undefined}
                              className={
                                isLast
                                  ? "min-w-0 truncate font-bold text-[#173A67] hover:underline"
                                  : "min-w-0 max-w-[6rem] truncate text-on-surface-variant hover:text-[#173A67] sm:max-w-[12rem] md:max-w-none"
                              }
                              href={crumb.href}
                            >
                              {crumb.label}
                            </Link>
                          </Fragment>
                        );
                      })}
                    </>
                  ) : page && subpage ? (
                    <>
                      <span className="shrink-0 text-outline">/</span>
                      <Link
                        prefetch={false}
                        className="min-w-0 max-w-[7rem] truncate text-on-surface-variant hover:text-[#173A67] sm:max-w-[12rem] md:max-w-none"
                        href={page.href}
                      >
                        {page.label}
                      </Link>
                      <span className="shrink-0 text-outline">/</span>
                      <span aria-current="page" className="min-w-0 truncate font-bold text-[#173A67]">
                        {subpage.label}
                      </span>
                    </>
                  ) : page && detailLabel ? (
                    <>
                      <span className="shrink-0 text-outline">/</span>
                      <Link
                        prefetch={false}
                        className="min-w-0 max-w-[7rem] truncate text-on-surface-variant hover:text-[#173A67] sm:max-w-[12rem] md:max-w-none"
                        href={page.href}
                      >
                        {page.label}
                      </Link>
                      <span className="shrink-0 text-outline">/</span>
                      <span aria-current="page" className="min-w-0 truncate font-bold text-[#173A67]">
                        {detailLabel}
                      </span>
                    </>
                  ) : page ? (
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
              prefetch={false}
              aria-label="Cài đặt tài khoản"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-dusty-light font-bold text-primary transition hover:opacity-90"
              href="/settings"
              title="Cài đặt / Avatar"
            >
              <Avatar alt="Ảnh đại diện" fallback={initial} loading="eager" size={32} src={profile?.avatar_url} />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-container-max flex-1 p-6 md:p-7 print:max-w-none print:p-0">
          {pendingPath ? <PageSkeleton variant="table" /> : null}
          <div className={pendingPath ? "hidden" : "contents"}>
            <AdminTrailContext.Provider value={setTrail}>{children}</AdminTrailContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
