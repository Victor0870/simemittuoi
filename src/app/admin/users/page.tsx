import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminUsersTable,
  type AdminUserRow,
} from "@/components/admin/AdminUsersTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-amber-400 hover:text-amber-800"
              href="/admin/scores"
            >
              <MaterialIcon className="text-[18px] text-amber-600" name="military_tech" />
              <span>Quản lý & Cộng điểm</span>
            </Link>
            <Link
              className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
              href="/admin/polls"
            >
              <MaterialIcon className="text-[18px] text-primary" name="how_to_vote" />
              <span>Quản lý Bình chọn</span>
            </Link>
            <span className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3 py-1.5 text-label-md font-bold text-white shadow-xs">
              <MaterialIcon className="text-[18px]" name="manage_accounts" />
              <span>Duyệt đoàn viên</span>
            </span>
          </div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Quản lý & Duyệt đoàn viên</h1>
          <p className="text-body-md text-[#27496D]">
            Duyệt hoặc từ chối tài khoản đăng ký theo mã nhân viên.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href="/"
        >
          ← Về trang chủ
        </Link>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-error">{error.message}</p>
      ) : null}

      <AdminUsersTable users={(users ?? []) as AdminUserRow[]} />
    </>
  );
}
