"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  // Bộ lọc các cột
  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Sắp xếp
  type SortColumn = "code" | "name" | "dept" | "status" | "role";
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }

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

    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "code") {
        cmp = (a.employee_code ?? "").localeCompare(b.employee_code ?? "", "vi", { numeric: true });
      } else if (sortColumn === "name") {
        cmp = a.full_name.localeCompare(b.full_name, "vi");
      } else if (sortColumn === "dept") {
        cmp = (a.department ?? "").localeCompare(b.department ?? "", "vi");
      } else if (sortColumn === "status") {
        cmp = a.approval_status.localeCompare(b.approval_status, "vi");
      } else if (sortColumn === "role") {
        cmp = a.role.localeCompare(b.role, "vi");
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [users, search, codeFilter, nameFilter, deptFilter, statusFilter, roleFilter, sortColumn, sortDirection]);

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
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

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

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            {/* Hàng 1: Tiêu đề cột & Sắp xếp */}
            <tr className="border-b border-[#173A67]/15">
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("code")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Sắp xếp theo Mã NV"
                >
                  <span>Mã NV</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "code"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"
                    }
                  />
                </button>
              </th>
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Sắp xếp theo Họ tên"
                >
                  <span>Họ tên</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "name"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"
                    }
                  />
                </button>
              </th>
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("dept")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Sắp xếp theo Bộ phận"
                >
                  <span>Bộ phận</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "dept"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"
                    }
                  />
                </button>
              </th>
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Sắp xếp theo Trạng thái"
                >
                  <span>Trạng thái</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "status"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"
                    }
                  />
                </button>
              </th>
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("role")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Sắp xếp theo Vai trò"
                >
                  <span>Vai trò</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "role"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"
                    }
                  />
                </button>
              </th>
              <th className="px-3 py-2.5 text-right font-bold text-[#173A67] whitespace-nowrap">
                Thao tác
              </th>
            </tr>

            {/* Hàng 2: Bộ lọc riêng từng cột */}
            <tr className="bg-surface-container-low/80 border-b border-outline-variant font-normal">
              {/* Cột 1: Lọc Mã NV */}
              <th className="p-2 font-normal">
                <div className="relative flex items-center min-w-[90px]">
                  <input
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
              </th>

              {/* Cột 2: Lọc Họ tên */}
              <th className="p-2 font-normal">
                <div className="relative flex items-center min-w-[130px]">
                  <input
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
              </th>

              {/* Cột 3: Lọc Bộ phận */}
              <th className="p-2 font-normal">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full min-w-[120px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
                >
                  <option value="all">Tất cả ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__none__">Chưa có bộ phận</option>
                </select>
              </th>

              {/* Cột 4: Lọc Trạng thái duyệt */}
              <th className="p-2 font-normal">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full min-w-[110px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Bị từ chối</option>
                </select>
              </th>

              {/* Cột 5: Lọc Vai trò */}
              <th className="p-2 font-normal">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full min-w-[100px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
                >
                  <option value="all">Tất cả</option>
                  <option value="admin">Quản trị viên</option>
                  <option value="user">Đoàn viên</option>
                </select>
              </th>

              {/* Cột 6: Thao tác & Reset filter */}
              <th className="p-2 text-right font-normal">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition shadow-2xs whitespace-nowrap"
                    title="Xóa tất cả các bộ lọc đang chọn"
                  >
                    <MaterialIcon className="text-[13px]" name="filter_alt_off" />
                    <span>Xóa lọc</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-on-surface-variant/60 whitespace-nowrap">
                    Bộ lọc cột
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-on-surface-variant" colSpan={6}>
                  <MaterialIcon className="mx-auto mb-1 text-[28px] text-on-surface-variant/40" name="search_off" />
                  <p className="font-semibold text-on-surface">Không tìm thấy tài khoản phù hợp với bộ lọc.</p>
                </td>
              </tr>
            ) : null}
            {filteredAndSorted.map((row) => {
              const statusCfg = STATUS_MAP[row.approval_status] ?? {
                label: row.approval_status,
                className: "bg-surface-container-high text-on-surface",
              };
              return (
                <tr key={row.id} className="border-t border-outline-variant hover:bg-surface-container-low/50 transition">
                  <td className="px-4 py-3 font-semibold text-[#173A67]">
                    {row.employee_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-on-surface">{row.full_name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {row.department ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-on-surface-variant">
                    {row.role === "admin" ? (
                      <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 border border-purple-200">
                        Admin
                      </span>
                    ) : (
                      "Đoàn viên"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

