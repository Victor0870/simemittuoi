"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";
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
  { key: "overview", label: "Tổng quan", icon: "dashboard", href: "/admin", prefixes: [], exact: ["/admin"] },
  {
    key: "members",
    label: "Quản lý đoàn viên",
    icon: "groups",
    href: "/admin/members-hub",
    prefixes: ["/admin/members-hub", "/admin/users", "/admin/employees", "/admin/members"],
  },
  {
    key: "competition",
    label: "Hoạt động thi đua",
    icon: "military_tech",
    href: "/admin/competition",
    prefixes: ["/admin/competition", "/admin/scores", "/admin/quiz", "/admin/polls"],
  },
  {
    key: "content",
    label: "Quản lý nội dung",
    icon: "article",
    href: "/admin/content",
    prefixes: ["/admin/content", "/admin/popups", "/admin/activities"],
  },
  {
    key: "administration",
    label: "Quản lý hành chính",
    icon: "assignment",
    href: "/admin/administration",
    prefixes: ["/admin/administration"],
  },
  {
    key: "finance",
    label: "Tài chính công đoàn",
    icon: "account_balance_wallet",
    href: "/admin/finance",
    prefixes: ["/admin/finance", "/admin/regulations"],
  },
  {
    key: "documents",
    label: "Văn bản công đoàn",
    icon: "description",
    href: "/admin/documents",
    prefixes: ["/admin/documents"],
  },
  {
    key: "system",
    label: "Hệ thống",
    icon: "settings",
    href: "/admin/system",
    prefixes: ["/admin/system", "/admin/roles", "/admin/union-settings"],
  },
];

export type AdminChildPage = {
  href: string;
  label: string;
  /** Trang con cấp 4 (breadcrumb: hub / trang / trang con). */
  subpages?: AdminChildPage[];
};

/** Trang con của từng hub (nhãn trùng với ô trên trang hub), dùng cho breadcrumb 3 cấp. */
export const ADMIN_CHILD_PAGES: Record<string, AdminChildPage[]> = {
  members: [
    { href: "/admin/users", label: "Duyệt thành viên" },
    { href: "/admin/members", label: "Hồ sơ đoàn viên" },
    { href: "/admin/employees", label: "DS nhân viên được đăng ký" },
  ],
  competition: [
    { href: "/admin/scores", label: "Cộng điểm" },
    { href: "/admin/scores/history", label: "Lịch sử cộng điểm" },
    { href: "/admin/scores/members", label: "Bảng điểm đoàn viên" },
    { href: "/admin/polls", label: "Bình chọn" },
    { href: "/admin/quiz", label: "Trắc nghiệm" },
    { href: "/admin/competition/feedback", label: "Góp ý" },
  ],
  content: [
    {
      href: "/admin/content/posts",
      label: "Bài viết",
      subpages: [{ href: "/admin/content/posts/submissions", label: "Tác phẩm dự thi" }],
    },
    { href: "/admin/content/guides", label: "Hướng dẫn sử dụng" },
    { href: "/admin/content/albums", label: "Album ảnh" },
    { href: "/admin/activities", label: "Hoạt động & phong trào" },
    { href: "/admin/popups", label: "Popup thông báo" },
  ],
  administration: [
    { href: "/admin/administration/life-events", label: "Hộp tin báo" },
    { href: "/admin/administration/visits", label: "Đề nghị thăm hỏi" },
    { href: "/admin/administration/payments", label: "Đề nghị thanh toán" },
    { href: "/admin/administration/rewards", label: "Thanh toán thưởng" },
    { href: "/admin/administration/gifts/children", label: "Quà thiếu nhi" },
    { href: "/admin/administration/print-settings", label: "Cài đặt biểu mẫu in" },
  ],
  finance: [
    { href: "/admin/finance/income", label: "Tổng hợp thu" },
    { href: "/admin/finance/expense", label: "Tổng hợp chi" },
    { href: "/admin/finance/ledger", label: "Sổ quỹ" },
    { href: "/admin/finance/settings", label: "Quỹ & khóa sổ" },
    { href: "/admin/finance/reports", label: "Báo cáo tổng hợp" },
    { href: "/admin/finance/catalogs", label: "Danh mục thu chi" },
    { href: "/admin/regulations", label: "Quy chế chi tiêu" },
  ],
  documents: [
    { href: "/admin/documents/templates", label: "Mẫu văn bản" },
    { href: "/admin/documents/compose", label: "Soạn văn bản" },
    { href: "/admin/documents/registry", label: "Sổ văn bản" },
  ],
  system: [
    { href: "/admin/union-settings", label: "Cài đặt công đoàn" },
    { href: "/admin/roles", label: "Phân quyền theo cấp" },
  ],
};

function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function findAdminNavGroup(pathname: string): AdminNavGroup | null {
  return (
    ADMIN_NAV_GROUPS.find(
      (g) =>
        g.exact?.includes(pathname) ||
        g.prefixes.some((p) => matchesPath(pathname, p)) ||
        (ADMIN_CHILD_PAGES[g.key] ?? []).some((c) => matchesPath(pathname, c.href)),
    ) ?? null
  );
}

function longestMatch(pathname: string, pages: AdminChildPage[] | undefined): AdminChildPage | null {
  return (
    (pages ?? []).filter((c) => matchesPath(pathname, c.href)).sort((a, b) => b.href.length - a.href.length)[0] ??
    null
  );
}

/** Nhóm, trang con, trang con cấp 4 (nếu có) và cờ "đang ở chính trang hub" cho breadcrumb. */
export function resolveAdminLocation(pathname: string): {
  group: AdminNavGroup | null;
  page: AdminChildPage | null;
  subpage: AdminChildPage | null;
  isHub: boolean;
} {
  const group = findAdminNavGroup(pathname);
  if (!group) return { group: null, page: null, subpage: null, isHub: false };
  const page = longestMatch(pathname, ADMIN_CHILD_PAGES[group.key]);
  const subpage = longestMatch(pathname, page?.subpages);
  const isHub = group.key === "overview" || pathname === group.href;
  return { group, page, subpage, isHub };
}

const itemClass = "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition";

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || "/admin";
  const active = findAdminNavGroup(pathname);
  const overviewHref = "/admin";
  const { canOpenAdmin } = useAuth();
  const groups = ADMIN_NAV_GROUPS.filter((g) => g.key === "overview" || canOpenAdmin(g.href));

  return (
    <div className="flex h-full w-[270px] flex-col border-r border-dusty-border bg-surface-container-low text-on-surface-variant">
      <Link
        className="flex h-16 shrink-0 items-center gap-2 whitespace-nowrap border-b border-dusty-border px-5 text-[#173A67]"
        href={overviewHref}
        onClick={onNavigate}
      >
        <MaterialIcon className="text-[24px]" name="shield" />
        <span className="text-base font-extrabold tracking-wide">{BRAND.name}</span>
        <span className="text-xs font-semibold text-on-surface-variant">Quản trị</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {groups.map((g) => {
          const isActive = active?.key === g.key;
          return (
            <Link
              key={g.key}
              aria-current={isActive ? "page" : undefined}
              className={`${itemClass} ${isActive ? "bg-primary text-white" : "hover:bg-surface-container-high"}`}
              href={g.key === "overview" ? overviewHref : g.href}
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
