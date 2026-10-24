"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { TempPasswordDialog, useTempPasswordReset } from "@/components/admin/TempPasswordReset";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

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

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  approved: { label: "Đã duyệt", className: "bg-[#D9F2EC] text-[#173A67]" },
  pending: { label: "Chờ duyệt", className: "bg-primary-fixed text-on-primary-fixed" },
  rejected: { label: "Bị từ chối", className: "bg-error-container text-on-error-container" },
};

export function AdminUsersTable({ users }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tempReset = useTempPasswordReset();

  // Bộ lọc các cột
  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.department?.trim()) set.add(u.department.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [users]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      codeFilter.trim() ||
      nameFilter.trim() ||
      deptFilter !== "all" ||
      statusFilter !== "all" ||
      roleFilter !== "all",
  );

  function clearAllFilters() {
    setSearch("");
    setCodeFilter("");
    setNameFilter("");
    setDeptFilter("all");
    setStatusFilter("all");
    setRoleFilter("all");
  }

  const filteredAndSorted = useMemo(() => {
    const qGlobal = removeVietnameseTones(search.trim());
    const qCode = codeFilter.trim().toLowerCase();
    const qName = removeVietnameseTones(nameFilter.trim());

    const list = users.filter((u) => {
      // 1. Mã NV
      if (qCode && !(u.employee_code ?? "").toLowerCase().includes(qCode)) {
        return false;
      }

      // 2. Họ tên
      if (qName && !removeVietnameseTones(u.full_name).includes(qName)) {
        return false;
      }

      // 3. Bộ phận
      if (deptFilter !== "all") {
        if (deptFilter === "__none__") {
          if (u.department && u.department.trim()) return false;
        } else {
          if (u.department?.trim() !== deptFilter) return false;
        }
      }

      // 4. Trạng thái
      if (statusFilter !== "all" && u.approval_status !== statusFilter) {
        return false;
      }

      // 5. Vai trò
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }

      // 6. Tìm nhanh chung
      if (qGlobal) {
        const matchCode = (u.employee_code ?? "").toLowerCase().includes(qGlobal);
        const matchName = removeVietnameseTones(u.full_name).includes(qGlobal);
        const matchDept = removeVietnameseTones(u.department ?? "").includes(qGlobal);
        if (!matchCode && !matchName && !matchDept) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
  }, [users, search, codeFilter, nameFilter, deptFilter, statusFilter, roleFilter]);

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: "employee_code",
      header: "Mã NV",
      className: "font-semibold text-[#173A67]",
      render: (row) => row.employee_code ?? "—",
    },
    {
      key: "full_name",
      header: "Họ tên",
      className: "font-semibold text-on-surface",
    },
    {
      key: "department",
      header: "Bộ phận",
      type: "enum",
      className: "text-on-surface-variant",
      render: (row) => row.department ?? "—",
    },
    {
      key: "approval_status",
      header: "Trạng thái",
      type: "enum",
      accessor: (row) => STATUS_MAP[row.approval_status]?.label ?? row.approval_status,
      render: (row) => {
        const statusCfg = STATUS_MAP[row.approval_status] ?? {
          label: row.approval_status,
          className: "bg-surface-container-high text-on-surface",
        };
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        );
      },
    },
    {
      key: "role",
      header: "Vai trò",
      type: "enum",
      accessor: (row) => (row.role === "admin" ? "Admin" : "Đoàn viên"),
      className: "text-xs font-semibold text-on-surface-variant",
      render: (row) =>
        row.role === "admin" ? (
          <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 border border-purple-200">
            Admin
          </span>
        ) : (
          "Đoàn viên"
        ),
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      className: "text-right",
      headerClassName: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            className="rounded-lg bg-tertiary px-3 py-1.5 text-xs font-bold text-on-tertiary transition hover:shadow-xs disabled:opacity-50"
            disabled={busyId === row.id || row.approval_status === "approved"}
            type="button"
            onClick={() => void updateStatus(row.id, "approved")}
          >
            Duyệt
          </button>
          <button
            className="rounded-lg border border-error px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error/10 disabled:opacity-50"
            disabled={busyId === row.id || row.approval_status === "rejected"}
            type="button"
            onClick={() => void updateStatus(row.id, "rejected")}
          >
            Từ chối
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-[#173A67]/40 px-2.5 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#173A67]/5 disabled:opacity-50"
            disabled={tempReset.busyUserId === row.id}
            title="Cấp mật khẩu tạm khi đoàn viên quên mật khẩu"
            type="button"
            onClick={() => void tempReset.issue(row.id, row.full_name)}
          >
            <MaterialIcon className="text-[15px]" name="key" />
            MK tạm
          </button>
        </div>
      ),
    },
  ];

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
      .from(CDILV_TABLE.profiles)
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
      {error || tempReset.error ? (
        <p className="text-sm text-error" role="alert">
          {error || tempReset.error}
        </p>
      ) : null}
      <TempPasswordDialog issued={tempReset.issued} onClose={tempReset.clearIssued} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === "all"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Tất cả ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === "pending"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Chờ duyệt ({users.filter((u) => u.approval_status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === "approved"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Đã duyệt ({users.filter((u) => u.approval_status === "approved").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === "rejected"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Bị từ chối ({users.filter((u) => u.approval_status === "rejected").length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <MaterialIcon
              className="absolute left-2.5 text-[18px] text-on-surface-variant/60 pointer-events-none"
              name="search"
            />
            <input
              className="w-full max-w-[200px] sm:max-w-xs rounded-xl border border-outline-variant bg-surface pl-8 pr-7 py-2 text-xs outline-none focus:border-[#173A67]"
              placeholder="Tìm nhanh chung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 text-on-surface-variant/60 hover:text-on-surface"
              >
                <MaterialIcon className="text-[14px]" name="close" />
              </button>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-2xs whitespace-nowrap"
              title="Đặt lại toàn bộ lọc"
            >
              <MaterialIcon className="text-[15px]" name="filter_alt_off" />
              <span>Xóa lọc</span>
            </button>
          ) : null}

          <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">
            {filteredAndSorted.length} / {users.length} tài khoản
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-low/80 p-2">
        <span className="px-1 text-[11px] font-medium text-on-surface-variant/60 whitespace-nowrap">Bộ lọc cột</span>

        {/* Lọc Mã NV */}
        <div className="relative flex w-[120px] items-center">
          <input
            aria-label="Lọc mã NV"
            type="text"
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            placeholder="Lọc mã..."
            className="w-full rounded-lg border border-outline-variant bg-white px-2 py-1 pr-6 text-xs text-on-surface outline-none focus:border-[#173A67]"
          />
          {codeFilter ? (
            <button
              type="button"
              onClick={() => setCodeFilter("")}
              className="absolute right-1.5 text-on-surface-variant/60 hover:text-on-surface"
              title="Xóa lọc mã"
            >
              <MaterialIcon className="text-[14px]" name="close" />
            </button>
          ) : null}
        </div>

        {/* Lọc Họ tên */}
        <div className="relative flex w-[170px] items-center">
          <input
            aria-label="Lọc họ tên"
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Lọc họ tên..."
            className="w-full rounded-lg border border-outline-variant bg-white px-2 py-1 pr-6 text-xs text-on-surface outline-none focus:border-[#173A67]"
          />
          {nameFilter ? (
            <button
              type="button"
              onClick={() => setNameFilter("")}
              className="absolute right-1.5 text-on-surface-variant/60 hover:text-on-surface"
              title="Xóa lọc tên"
            >
              <MaterialIcon className="text-[14px]" name="close" />
            </button>
          ) : null}
        </div>

        {/* Lọc Bộ phận */}
        <select
          aria-label="Lọc bộ phận"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="min-w-[120px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
        >
          <option value="all">Tất cả bộ phận ({departments.length})</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value="__none__">Chưa có bộ phận</option>
        </select>

        {/* Lọc Trạng thái duyệt */}
        <select
          aria-label="Lọc trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-[110px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Bị từ chối</option>
        </select>

        {/* Lọc Vai trò */}
        <select
          aria-label="Lọc vai trò"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="min-w-[100px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
        >
          <option value="all">Mọi vai trò</option>
          <option value="admin">Quản trị viên</option>
          <option value="user">Đoàn viên</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        emptyText="Không tìm thấy tài khoản phù hợp với bộ lọc."
        rowKey={(row) => row.id}
        rows={filteredAndSorted}
      />
    </div>
  );
}

