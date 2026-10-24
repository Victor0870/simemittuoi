import { redirect } from "next/navigation";
import {
  AdminRolesManager,
  type AssignableMember,
} from "@/components/admin/AdminRolesManager";
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
          <h1 className="text-headline-md font-bold text-[#173A67]">Phân quyền theo cấp</h1>
          <p className="text-body-md text-[#27496D]">
            Tạo cấp (Manager, Kế toán, Ủy viên…), chọn quyền cho từng cấp và gán thành viên vào cấp.
          </p>
        </div>
      </div>

      <AdminRolesManager
        logs={logs}
        members={(members ?? []) as AssignableMember[]}
        roles={roles}
      />
    </>
  );
}
