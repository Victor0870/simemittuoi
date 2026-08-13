import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  AdminUsersTable,
  type AdminUserRow,
} from "@/components/admin/AdminUsersTable";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/users");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "admin" || me?.approval_status !== "approved") {
    redirect("/");
  }

  const { data: users, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, employee_code, department, role, approval_status, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <AppShell activeHref="/admin/users">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md text-[#173A67]">Quản lý đoàn viên</h1>
          <p className="text-body-md text-[#27496D]">
            Duyệt hoặc từ chối tài khoản đăng ký theo mã nhân viên.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67]"
          href="/"
        >
          ← Về trang chủ
        </Link>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-error">{error.message}</p>
      ) : null}

      <AdminUsersTable users={(users ?? []) as AdminUserRow[]} />
    </AppShell>
  );
}
