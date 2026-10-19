import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminRolesManager,
  type AssignableMember,
} from "@/components/admin/AdminRolesManager";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { loadRecentPermissionLogs, loadRolesWithDetails } from "@/lib/data/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRolesPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/roles");
  if (!access.isAdmin) redirect("/");

  const db = createServiceClient();
  const [roles, logs, { data: members }] = await Promise.all([
    loadRolesWithDetails(db),
    loadRecentPermissionLogs(db),
    db
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, employee_code, department, role")
      .eq("approval_status", "approved")
      .order("full_name", { ascending: true }),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-[#173A67] hover:text-[#173A67]"
              href="/admin"
            >
              <MaterialIcon className="text-[18px] text-[#173A67]" name="dashboard" />
              <span>Tổng quan Admin</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3 py-1.5 text-label-md font-bold text-white shadow-xs">
              <MaterialIcon className="text-[18px]" name="admin_panel_settings" />
              <span>Phân quyền</span>
            </span>
          </div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Phân quyền theo cấp</h1>
          <p className="text-body-md text-[#27496D]">
            Tạo cấp (Manager, Kế toán, Ủy viên…), chọn quyền cho từng cấp và gán thành viên vào cấp.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href="/admin"
        >
          ← Về trang Admin
        </Link>
      </div>

      <AdminRolesManager
        logs={logs}
        members={(members ?? []) as AssignableMember[]}
        roles={roles}
      />
    </>
  );
}
