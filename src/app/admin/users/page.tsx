import { redirect } from "next/navigation";
import {
  AdminUsersTable,
  type AdminUserRow,
} from "@/components/admin/AdminUsersTable";
import {
  AdminPasswordResetRequests,
  type PasswordResetRequestItem,
} from "@/components/admin/AdminPasswordResetRequests";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/users");
  }

  const { data: me } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const { data: users, error } = await supabase
    .from(CDILV_TABLE.profiles)
    .select(
      "id, full_name, employee_code, department, role, approval_status, created_at",
    )
    .order("created_at", { ascending: false });

  const { data: resetRows } = await createServiceClient()
    .from(CDILV_TABLE.passwordResetRequests)
    .select("id, user_id, email, contact, email_sent, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const profileById = new Map((users ?? []).map((u) => [u.id, u]));
  const resetByUser = new Map<string, PasswordResetRequestItem>();
  for (const r of resetRows ?? []) {
    const existing = resetByUser.get(r.user_id);
    if (existing) {
      existing.requestCount += 1;
      existing.contact ??= r.contact;
      continue;
    }
    const profile = profileById.get(r.user_id);
    resetByUser.set(r.user_id, {
      id: r.id,
      userId: r.user_id,
      fullName: profile?.full_name || r.email,
      employeeCode: profile?.employee_code ?? null,
      department: profile?.department ?? null,
      email: r.email,
      contact: r.contact,
      emailSent: r.email_sent,
      createdAt: r.created_at,
      requestCount: 1,
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Quản lý & Duyệt đoàn viên</h1>
          <p className="text-body-md text-[#27496D]">
            Duyệt hoặc từ chối tài khoản đăng ký theo mã nhân viên.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-error">{error.message}</p>
      ) : null}

      <AdminPasswordResetRequests requests={Array.from(resetByUser.values())} />

      <AdminUsersTable users={(users ?? []) as AdminUserRow[]} />
    </>
  );
}
