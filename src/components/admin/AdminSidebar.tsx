"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { BRAND } from "@/lib/brand";

export type AdminNavGroup = {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Tiền tố đường dẫn thuộc nhóm (khớp chính nó hoặc trang con). */
  prefixes: string[];
  /** Đường dẫn chỉ khớp chính xác. */
  exact?: string[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { key: "overview", label: "Tổng quan", icon: "dashboard", href: "/admin", prefixes: [], exact: ["/admin", "/office"] },
  {
    key: "members",
    label: "Quản lý đoàn viên",
    icon: "groups",
    href: "/admin/members-hub",
    prefixes: ["/admin/members-hub", "/admin/users", "/admin/employees", "/office/members"],
  },
  {
    key: "competition",
    label: "Hoạt động thi đua",
    icon: "military_tech",
    href: "/admin/competition",
    prefixes: ["/admin/competition", "/admin/scores", "/admin/quiz", "/admin/polls", "/feedback", "/leaderboard"],
  },
  {
    key: "content",
    label: "Quản lý nội dung",
    icon: "article",
    href: "/admin/content",
    prefixes: ["/admin/content", "/admin/popups", "/admin/activities", "/posts", "/albums"],
  },
  {
    key: "administration",
    label: "Quản lý hành chính",
    icon: "assignment",
    href: "/admin/administration",
    prefixes: [
      "/admin/administration",
      "/office/life-events",
      "/office/visits",
      "/office/payments",
      "/office/rewards",
      "/office/gifts",
      "/office/print-settings",
    ],
  },
  {
    key: "finance",
    label: "Tài chính công đoàn",
    icon: "account_balance_wallet",
    href: "/admin/finance",
    prefixes: ["/admin/finance", "/office/finance", "/office/reports", "/office/catalogs"],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: "settings",
    href: "/admin/system",
    prefixes: ["/admin/system", "/admin/roles"],
  },
];

export function findAdminNavGroup(pathname: string): AdminNavGroup | null {
  return (
    ADMIN_NAV_GROUPS.find(
      (g) => g.exact?.includes(pathname) || g.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
    ) ?? null
  );
}

const itemClass = "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition";

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || "/admin";
  const active = findAdminNavGroup(pathname);

  return (
    <div className="flex h-full w-[270px] flex-col border-r border-dusty-border bg-surface-container-low text-on-surface-variant">
      <Link
        className="flex h-16 shrink-0 items-center gap-2 whitespace-nowrap border-b border-dusty-border px-5 text-[#173A67]"
        href="/admin"
        onClick={onNavigate}
      >
        <MaterialIcon className="text-[24px]" name="shield" />
        <span className="text-base font-extrabold tracking-wide">{BRAND.name}</span>
        <span className="text-xs font-semibold text-on-surface-variant">Quản trị</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ADMIN_NAV_GROUPS.map((g) => {
          const isActive = active?.key === g.key;
          return (
            <Link
              key={g.key}
              aria-current={isActive ? "page" : undefined}
              className={`${itemClass} ${isActive ? "bg-primary text-white" : "hover:bg-surface-container-high"}`}
              href={g.href}
              onClick={onNavigate}
            >
              <MaterialIcon className="text-[20px]" name={g.icon} />
              <span>{g.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-dusty-border p-3">
        <Link className={`${itemClass} hover:bg-surface-container-high`} href="/" onClick={onNavigate}>
          <MaterialIcon className="text-[20px]" name="home" />
          <span>Trang đoàn viên</span>
        </Link>
        <AdminLogoutButton variant="sidebar" />
      </div>
    </div>
  );
}
