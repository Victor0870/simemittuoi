"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminUserRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  role: string;
  approval_status: string;
  created_at: string;
};

type Props = {
  users: AdminUserRow[];
};

export function AdminUsersTable({ users }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(userId: string, approval_status: "approved" | "rejected") {
    setBusyId(userId);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Phiên đăng nhập hết hạn.");
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        approval_status,
        approved_at: approval_status === "approved" ? new Date().toISOString() : null,
        approved_by: approval_status === "approved" ? user.id : null,
      })
      .eq("id", userId);

    setBusyId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  if (users.length === 0) {
    return (
      <p className="rounded-2xl bg-[#D9F2EC] p-6 text-[#27496D]">
        Chưa có tài khoản nào trong danh sách.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr>
              <th className="px-4 py-3">Mã NV</th>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Bộ phận</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="border-t border-outline-variant">
                <td className="px-4 py-3 font-semibold text-[#173A67]">
                  {row.employee_code ?? "—"}
                </td>
                <td className="px-4 py-3">{row.full_name}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {row.department ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      row.approval_status === "approved"
                        ? "bg-[#D9F2EC] text-[#173A67]"
                        : row.approval_status === "rejected"
                          ? "bg-error-container text-on-error-container"
                          : "bg-primary-fixed text-on-primary-fixed"
                    }`}
                  >
                    {row.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3">{row.role}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-tertiary px-3 py-1.5 text-xs font-bold text-on-tertiary disabled:opacity-50"
                      disabled={busyId === row.id || row.approval_status === "approved"}
                      type="button"
                      onClick={() => void updateStatus(row.id, "approved")}
                    >
                      Duyệt
                    </button>
                    <button
                      className="rounded-lg border border-error px-3 py-1.5 text-xs font-bold text-error disabled:opacity-50"
                      disabled={busyId === row.id || row.approval_status === "rejected"}
                      type="button"
                      onClick={() => void updateStatus(row.id, "rejected")}
                    >
                      Từ chối
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
