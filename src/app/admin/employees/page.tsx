import { redirect } from "next/navigation";
import {
  AdminEmployeesManager,
  type WhitelistEmployeeRow,
} from "@/components/admin/AdminEmployeesManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEmployeesPage() {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login?next=/admin/employees");
  }
  if (!hasPermission(access, PERMISSIONS.employeesView)) {
    redirect("/");
  }
  const canManage = hasPermission(access, PERMISSIONS.employeesManage);

  const supabase = await createClient();
  const [{ data: employees, error }, { data: profiles }] = await Promise.all([
    supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .select("employee_code, full_name, department, is_active, is_hardship, hardship_note, created_at")
      .order("employee_code", { ascending: true }),
    supabase
      .from(CDILV_TABLE.profiles)
      .select("employee_code, approval_status")
      .not("employee_code", "is", null),
  ]);

  const registeredStatus: Record<string, string> = {};
  for (const p of profiles ?? []) {
    if (p.employee_code) {
      registeredStatus[String(p.employee_code).trim().toUpperCase()] = p.approval_status;
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold text-[#173A67]">
            Danh sách nhân viên được phép đăng ký
          </h1>
          <p className="text-body-md text-[#27496D]">
            Chỉ những mã nhân viên đang hoạt động trong danh sách này mới đăng ký được tài khoản.
            {canManage ? "" : " Bạn đang ở chế độ chỉ xem."}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-error">{error.message}</p>
      ) : null}

      <AdminEmployeesManager
        canManage={canManage}
        employees={(employees ?? []) as WhitelistEmployeeRow[]}
        registeredStatus={registeredStatus}
      />
    </>
  );
}
