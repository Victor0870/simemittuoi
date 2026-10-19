"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type AccountItem = {
  href: string;
  label: string;
  hint: string;
  icon: string;
  memberOnly?: boolean;
};

export const ACCOUNT_ITEMS: AccountItem[] = [
  { href: "/settings", label: "Thông tin tài khoản", hint: "Cấp bậc, ảnh đại diện, điểm số", icon: "manage_accounts" },
  { href: "/profile", label: "Thông tin cá nhân", hint: "Hồ sơ đoàn viên", icon: "contact_page", memberOnly: true },
  { href: "/life-events", label: "Báo tin", hint: "Tin vui, tin buồn, tin ốm", icon: "campaign", memberOnly: true },
  { href: "/feedback", label: "Góp ý", hint: "Ý kiến, nguyện vọng", icon: "rate_review" },
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
      ? { href: "/office", label: "Khu vực quản lý", icon: "work" }
      : null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
      <aside className="print:hidden md:sticky md:top-24 md:self-start">
        <p className="mb-2 hidden px-2 text-xs font-bold tracking-wide text-on-surface-variant uppercase md:block">
          Tài khoản của tôi
        </p>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold transition md:border-transparent md:py-2.5 ${
                  active
                    ? "border-[#173A67] bg-[#173A67] text-white md:bg-[#173A67]"
                    : "border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low hover:text-[#173A67] md:bg-transparent"
                }`}
                href={item.href}
              >
                <MaterialIcon className="text-[20px]" name={item.icon} />
                <span className="flex flex-col">
                  <span className="whitespace-nowrap">{item.label}</span>
                  <span
                    className={`hidden text-[11px] font-normal md:block ${active ? "text-white/75" : "text-on-surface-variant"}`}
                  >
                    {item.hint}
                  </span>
                </span>
              </Link>
            );
          })}
          {manageLink ? (
            <Link
              className="flex shrink-0 items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 md:mt-3"
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
