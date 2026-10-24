import { redirect } from "next/navigation";
import { HubPage, type HubKpi, type HubTile } from "@/components/admin/HubPage";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MembersHubPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/members-hub");

  let kpis: HubKpi[] = [];
  let pendingCount = 0;
  if (access.isAdmin) {
    const supabase = await createClient();
    const [{ count: pending }, { count: approved }, { data: employees }, { data: profiles }] = await Promise.all([
      supabase.from(CDILV_TABLE.profiles).select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      supabase.from(CDILV_TABLE.profiles).select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
      supabase.from(CDILV_TABLE.employeeWhitelist).select("employee_code, is_active"),
      supabase.from(CDILV_TABLE.profiles).select("employee_code").not("employee_code", "is", null),
    ]);
    const registered = new Set((profiles ?? []).map((p) => String(p.employee_code).trim().toUpperCase()));
    const activeCodes = (employees ?? []).filter((e) => e.is_active);
    const unregistered = activeCodes.filter((e) => !registered.has(String(e.employee_code).trim().toUpperCase())).length;
    pendingCount = pending ?? 0;
    kpis = [
      { label: "Đoàn viên đã duyệt", value: approved ?? 0, icon: "verified_user" },
      { label: "Chờ duyệt", value: pendingCount, icon: "pending_actions" },
      { label: "Mã NV được đăng ký", value: activeCodes.length, icon: "badge" },
      { label: "Chưa đăng ký", value: unregistered, icon: "person_off" },
    ];
  }

  const tiles: (HubTile & { allowed: boolean })[] = [
    {
      href: "/admin/users",
      title: "Duyệt thành viên",
      description: "Xét duyệt tài khoản đăng ký mới theo mã nhân viên, phê duyệt hoặc từ chối, quản lý danh sách thành viên.",
      icon: "manage_accounts",
      tint: "dusty",
      badge: pendingCount > 0 ? `${pendingCount} chờ duyệt` : null,
      allowed: access.isAdmin,
    },
    {
      href: "/office/members",
      title: "Hồ sơ đoàn viên",
      description: "Tra cứu hồ sơ, tình trạng khai báo, thông tin con của đoàn viên.",
      icon: "contact_page",
      tint: "surface",
      allowed: hasPermission(access, PERMISSIONS.membersView),
    },
    {
      href: "/admin/employees",
      title: "DS nhân viên được đăng ký",
      description: "Danh sách mã nhân viên được phép đăng ký: thêm mới, sửa thông tin, ngừng cấp quyền.",
      icon: "badge",
      tint: "dusty",
      allowed: hasPermission(access, PERMISSIONS.employeesView),
    },
    {
      href: "/admin/users#password-resets",
      title: "Yêu cầu đặt lại mật khẩu",
      description: "Các yêu cầu quên mật khẩu đoàn viên gửi lên, chờ Quản trị viên xử lý.",
      icon: "lock_reset",
      tint: "amber",
      allowed: access.isAdmin,
    },
  ];

  return (
    <HubPage
      hubKey="members-hub"
      kpis={kpis}
      subtitle="Tài khoản, hồ sơ, danh sách nhân viên và mật khẩu"
      tiles={tiles.filter((t) => t.allowed)}
      title="Quản lý đoàn viên"
    />
  );
}
