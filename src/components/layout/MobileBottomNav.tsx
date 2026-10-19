"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { MEMBER_NAV_ITEMS, MOBILE_NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";

type MobileBottomNavProps = {
  activeHref?: string;
};

type NavItem = { href: string; label: string; icon: string };

const SECTION_PREFIXES = ["/admin", "/office", "/feedback", "/albums"];

export function MobileBottomNav({ activeHref = "/" }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { isAdmin, isApproved, hasAnyPermission } = useAuth();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const current = pendingHref ?? activeHref;

  const [homeItem, ...restItems] = MOBILE_NAV_ITEMS as readonly NavItem[];
  const memberItems: NavItem[] = isApproved
    ? MEMBER_NAV_ITEMS.map(({ href, shortLabel, icon }) => ({ href, label: shortLabel, icon }))
    : [];
  const accountItem: NavItem = isAdmin
    ? { href: "/admin", label: "Tài khoản", icon: "admin_panel_settings" }
    : { href: "/settings", label: "Tài khoản", icon: "person" };
  const officeItems: NavItem[] =
    hasAnyPermission && !isAdmin ? [{ href: "/office", label: "Quản lý", icon: "work" }] : [];
  const scrollItems: NavItem[] = [...restItems, ...memberItems, ...officeItems, accountItem];

  function isItemActive(href: string) {
    return (
      href === current ||
      (SECTION_PREFIXES.includes(href) && (pathname === href || pathname.startsWith(`${href}/`)))
    );
  }

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollHints();
    window.addEventListener("resize", updateScrollHints);
    return () => window.removeEventListener("resize", updateScrollHints);
  }, [updateScrollHints, scrollItems.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: right - el.clientWidth, behavior: "smooth" });
    }
  }, [pathname, scrollItems.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  function renderItem(item: NavItem, widthClass: string) {
    const isActive = isItemActive(item.href);

    return (
      <Link
        key={item.href}
        data-active={isActive}
        className={`flex h-full shrink-0 snap-start flex-col items-center justify-center py-1 transition-all ${widthClass} ${
          isActive ? "text-[#173A67]" : "text-slate-500 hover:text-slate-700"
        } ${pendingHref === item.href ? "scale-95 opacity-70" : ""}`}
        href={item.href}
        prefetch
        onClick={() => {
          if (item.href === pathname) return;
          setPendingHref(item.href);
          startTransition(() => undefined);
        }}
      >
        <div
          className={`flex items-center justify-center rounded-full px-2 py-0.5 transition-all ${
            isActive ? "bg-amber-100 text-amber-900" : ""
          }`}
        >
          <MaterialIcon className="text-[20px]" filled={isActive} name={item.icon} />
        </div>
        <span
          className={`mt-0.5 whitespace-nowrap text-[10px] tracking-tight ${
            isActive ? "font-extrabold text-[#173A67]" : "font-medium text-slate-600"
          }`}
        >
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-stretch border-t border-outline-variant/70 bg-white/95 shadow-[0_-3px_12px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden">
      {/* Trang chủ cố định: 1/5 chiều ngang màn hình */}
      <div className="flex w-1/5 shrink-0 border-r border-outline-variant/50">
        {renderItem(homeItem, "w-full")}
      </div>

      {/* Các menu còn lại cuộn ngang: mỗi mục 1/4 vùng cuộn = 1/5 màn hình */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={updateScrollHints}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {scrollItems.map((item) => renderItem(item, "w-1/4"))}
        </div>

        {canScrollLeft && (
          <button
            type="button"
            aria-label="Xem menu phía trước"
            onClick={() => scrollByPage(-1)}
            className="absolute inset-y-0 left-0 flex w-4 items-center justify-center bg-gradient-to-r from-white via-white/90 to-transparent text-[#173A67]/70"
          >
            <MaterialIcon className="text-[18px]" name="arrow_left" />
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            aria-label="Xem thêm menu"
            onClick={() => scrollByPage(1)}
            className="absolute inset-y-0 right-0 flex w-4 items-center justify-center bg-gradient-to-l from-white via-white/90 to-transparent text-[#173A67]"
          >
            <MaterialIcon className="text-[18px]" name="arrow_right" />
          </button>
        )}
      </div>
    </div>
  );
}
