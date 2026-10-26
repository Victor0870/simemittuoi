"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type AccountItem = {
  href: string;
  label: string;
  /** Nhãn ngắn cho lưới menu trên điện thoại. */
  shortLabel: string;
  hint: string;
  icon: string;
  memberOnly?: boolean;
};

export const ACCOUNT_ITEMS: AccountItem[] = [
  {
    href: "/settings",
    label: "Thông tin tài khoản",
    shortLabel: "Tài khoản",
    hint: "Cấp bậc, ảnh đại diện, điểm số",
    icon: "manage_accounts",
  },
  {
    href: "/profile",
    label: "Thông tin cá nhân",
    shortLabel: "Cá nhân",
    hint: "Hồ sơ đoàn viên",
    icon: "contact_page",
    memberOnly: true,
  },
  {
    href: "/life-events",
    label: "Báo tin",
    shortLabel: "Báo tin",
    hint: "Tin vui, tin ốm, khó khăn",
    icon: "campaign",
    memberOnly: true,
  },
  { href: "/feedback", label: "Góp ý", shortLabel: "Góp ý", hint: "Ý kiến, nguyện vọng", icon: "rate_review" },
];

export function isAccountPath(pathname: string): boolean {
  return ACCOUNT_ITEMS.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const { isApproved, isAdmin, hasAnyPermission } = useAuth();
  const items = ACCOUNT_ITEMS.filter((i) => isApproved || !i.memberOnly);
  const manageLink = isAdmin
    ? { href: "/admin", label: "Trang quản trị", icon: "shield" }
    : hasAnyPermission
      ? { href: "/admin", label: "Khu vực quản lý", icon: "work" }
      : null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
      <aside className="min-w-0 print:hidden md:sticky md:top-24 md:self-start">
        <nav
          className="grid gap-1 rounded-2xl border border-outline-variant bg-white p-1 md:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-bold transition ${
                  active ? "bg-[#173A67] text-white" : "text-on-surface-variant active:bg-surface-container-low"
                }`}
                href={item.href}
              >
                <MaterialIcon className="text-[22px]" filled={active} name={item.icon} />
                <span className="w-full truncate text-center">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        <p className="mb-2 hidden px-2 text-xs font-bold tracking-wide text-on-surface-variant uppercase md:block">
          Tài khoản của tôi
        </p>
        <nav className="hidden flex-col gap-1 md:flex">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#173A67] text-white"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-[#173A67]"
                }`}
                href={item.href}
              >
                <MaterialIcon className="text-[20px]" name={item.icon} />
                <span className="flex flex-col">
                  <span className="whitespace-nowrap">{item.label}</span>
                  <span className={`text-[11px] font-normal ${active ? "text-white/75" : "text-on-surface-variant"}`}>
                    {item.hint}
                  </span>
                </span>
              </Link>
            );
          })}
          {manageLink ? (
            <Link
              className="mt-3 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              href={manageLink.href}
            >
              <MaterialIcon className="text-[20px]" name={manageLink.icon} />
              <span className="whitespace-nowrap">{manageLink.label}</span>
            </Link>
          ) : null}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
