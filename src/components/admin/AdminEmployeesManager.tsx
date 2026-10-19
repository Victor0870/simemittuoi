"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type WhitelistEmployeeRow = {
  employee_code: string;
  full_name: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
};

type Props = {
  employees: WhitelistEmployeeRow[];
  /** Mã NV (viết hoa) → approval_status của tài khoản đã đăng ký. */
  registeredStatus: Record<string, string>;
  /** false: chỉ xem (ẩn form thêm và nút sửa/ngừng). */
  canManage?: boolean;
};

type StatusFilter = "all" | "active" | "inactive" | "unregistered";

const EMPLOYEE_CODE_LENGTH = 4;

/** Mã chỉ gồm chữ số được đệm số 0 ở đầu cho đủ 4 ký tự (vd. 665 → 0665) để khớp khi đăng ký. */
function normalizeEmployeeCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (/^\d+$/.test(code) && code.length < EMPLOYEE_CODE_LENGTH) {
    return code.padStart(EMPLOYEE_CODE_LENGTH, "0");
  }
  return code;
}

const REGISTRATION_LABEL: Record<string, { label: string; className: string }> = {
  approved: { label: "Đã duyệt", className: "bg-[#D9F2EC] text-[#173A67]" },
  pending: { label: "Chờ duyệt", className: "bg-primary-fixed text-on-primary-fixed" },
  rejected: {
    label: "Bị từ chối",
    className: "bg-error-container text-on-error-container",
  },
};

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

export function AdminEmployeesManager({ employees, registeredStatus, canManage = true }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bộ lọc chung và bộ lọc riêng từng cột
  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [regFilter, setRegFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // Sắp xếp cột
  type SortColumn = "code" | "name" | "dept" | "reg" | "status";
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      codeFilter.trim() ||
      nameFilter.trim() ||
      deptFilter !== "all" ||
      regFilter !== "all" ||
      activeFilter !== "all",
  );

  function clearAllFilters() {
    setSearch("");
    setCodeFilter("");
    setNameFilter("");
    setDeptFilter("all");
    setRegFilter("all");
    setActiveFilter("all");
  }

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.department?.trim()) set.add(e.department.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [employees]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.is_active);
    const registered = active.filter(
      (e) => registeredStatus[e.employee_code.toUpperCase()],
    ).length;
    return { active: active.length, registered, unregistered: active.length - registered };
  }, [employees, registeredStatus]);

  const filtered = useMemo(() => {
    const qGlobal = removeVietnameseTones(search.trim());
    const qCode = codeFilter.trim().toLowerCase();
    const qName = removeVietnameseTones(nameFilter.trim());

    const list = employees.filter((e) => {
      const reg = registeredStatus[e.employee_code.toUpperCase()];

      // 1. Lọc theo Cột Mã NV
      if (qCode && !e.employee_code.toLowerCase().includes(qCode)) {
        return false;
      }

      // 2. Lọc theo Cột Họ tên
      if (qName && !removeVietnameseTones(e.full_name).includes(qName)) {
        return false;
      }

      // 3. Lọc theo Cột Bộ phận
      if (deptFilter !== "all") {
        if (deptFilter === "__none__") {
          if (e.department && e.department.trim()) return false;
        } else {
          if (e.department?.trim() !== deptFilter) return false;
        }
      }

      // 4. Lọc theo Cột Tài khoản
      if (regFilter !== "all") {
        if (regFilter === "unregistered") {
          if (reg) return false;
        } else {
          if (reg !== regFilter) return false;
        }
      }

      // 5. Lọc theo Cột Trạng thái hoạt động
      if (activeFilter === "active" && !e.is_active) return false;
      if (activeFilter === "inactive" && e.is_active) return false;

      // 6. Tìm kiếm chung (nếu có)
      if (qGlobal) {
        const matchCode = e.employee_code.toLowerCase().includes(qGlobal);
        const matchName = removeVietnameseTones(e.full_name).includes(qGlobal);
        const matchDept = removeVietnameseTones(e.department ?? "").includes(qGlobal);
        if (!matchCode && !matchName && !matchDept) return false;
      }

      return true;
    });

    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "code") {
        cmp = a.employee_code.localeCompare(b.employee_code, "vi", { numeric: true });
      } else if (sortColumn === "name") {
        cmp = a.full_name.localeCompare(b.full_name, "vi");
      } else if (sortColumn === "dept") {
        const dA = a.department ?? "";
        const dB = b.department ?? "";
        cmp = dA.localeCompare(dB, "vi");
      } else if (sortColumn === "reg") {
        const rA = registeredStatus[a.employee_code.toUpperCase()] ?? "";
        const rB = registeredStatus[b.employee_code.toUpperCase()] ?? "";
        cmp = rA.localeCompare(rB, "vi");
      } else if (sortColumn === "status") {
        cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [
    employees,
    registeredStatus,
    search,
    codeFilter,
    nameFilter,
    deptFilter,
    regFilter,
    activeFilter,
    sortColumn,
    sortDirection,
  ]);

  const normalizedCode = normalizeEmployeeCode(code);
  const existing = normalizedCode
    ? employees.find((e) => e.employee_code.toUpperCase() === normalizedCode)
    : undefined;

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const name = fullName.trim();
    const dept = department.trim();
    if (!normalizedCode || !name) {
      setError("Vui lòng nhập mã nhân viên và họ tên.");
      return;
    }
    if (existing) {
      setError(
        existing.is_active
          ? `Mã ${existing.employee_code} đã có trong danh sách (${existing.full_name}).`
          : `Mã ${existing.employee_code} đã có nhưng đang ngừng — bấm "Kích hoạt" ở dòng đó trong bảng.`,
      );
      return;
    }

    setAdding(true);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .insert({
        employee_code: normalizedCode,
        full_name: name,
        department: dept || null,
        is_active: true,
      });
    setAdding(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? `Mã ${normalizedCode} đã tồn tại trong danh sách.`
          : insertError.message,
      );
      return;
    }

    setSuccess(`Đã thêm ${name} (mã ${normalizedCode}). Nhân viên có thể đăng ký ngay.`);
    setCode("");
    setFullName("");
    setDepartment("");
    router.refresh();
  }

  function startEdit(row: WhitelistEmployeeRow) {
    setEditingCode(row.employee_code);
    setEditName(row.full_name);
    setEditDept(row.department ?? "");
    setError(null);
    setSuccess(null);
  }

  async function saveEdit(row: WhitelistEmployeeRow) {
    const name = editName.trim();
    if (!name) {
      setError("Họ tên không được để trống.");
      return;
    }

    setBusyCode(row.employee_code);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .update({ full_name: name, department: editDept.trim() || null })
      .eq("employee_code", row.employee_code);
    setBusyCode(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEditingCode(null);
    router.refresh();
  }

  async function toggleActive(row: WhitelistEmployeeRow) {
    if (
      row.is_active &&
      !window.confirm(
        `Ngừng cho phép mã ${row.employee_code} (${row.full_name}) đăng ký? Tài khoản đã đăng ký (nếu có) không bị ảnh hưởng.`,
      )
    ) {
      return;
    }

    setBusyCode(row.employee_code);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from(CDILV_TABLE.employeeWhitelist)
      .update({ is_active: !row.is_active })
      .eq("employee_code", row.employee_code);
    setBusyCode(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Đang được phép đăng ký</p>
          <p className="text-headline-sm font-bold text-[#173A67]">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Đã có tài khoản</p>
          <p className="text-headline-sm font-bold text-[#173A67]">{stats.registered}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Chưa đăng ký</p>
          <p className="text-headline-sm font-bold text-[#173A67]">{stats.unregistered}</p>
        </div>
      </div>

      {canManage ? (
      <form
        className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
        onSubmit={handleAdd}
      >
        <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="person_add" />
          Thêm nhân viên mới
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-label-md" htmlFor="newEmployeeCode">
              Mã NV
            </label>
            <input
              required
              className={inputClass}
              id="newEmployeeCode"
              placeholder="vd. 0665"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-label-md" htmlFor="newEmployeeName">
              Họ và tên
            </label>
            <input
              required
              className={inputClass}
              id="newEmployeeName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-label-md" htmlFor="newEmployeeDept">
              Bộ phận
            </label>
            <input
              className={inputClass}
              id="newEmployeeDept"
              list="whitelistDepartments"
              placeholder="Chọn hoặc nhập mới"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <datalist id="whitelistDepartments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <button
            className="rounded-xl bg-tertiary px-5 py-2 font-bold text-on-tertiary transition-shadow hover:shadow-md disabled:opacity-60"
            disabled={adding}
            type="submit"
          >
            {adding ? "Đang thêm..." : "Thêm"}
          </button>
        </div>
        {code.trim() && normalizedCode !== code.trim() ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            Mã sẽ được lưu là <strong>{normalizedCode}</strong> — nhân viên nhập đúng mã này khi đăng ký.
          </p>
        ) : null}
        {existing ? (
          <p className="mt-2 text-xs text-error">
            Mã {existing.employee_code} đã có: {existing.full_name}
            {existing.is_active ? "" : " (đang ngừng)"}
          </p>
        ) : null}
      </form>
      ) : null}

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Quick status tabs */}
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setRegFilter("all");
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeFilter === "all" && regFilter === "all"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Tất cả ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("active");
              setRegFilter("unregistered");
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeFilter === "active" && regFilter === "unregistered"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Chưa đăng ký ({stats.unregistered})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setRegFilter("approved");
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              regFilter === "approved"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Đã duyệt ({stats.registered})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("inactive");
              setRegFilter("all");
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeFilter === "inactive"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            Đã ngừng ({employees.length - stats.active})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <MaterialIcon
              className="absolute left-2.5 text-[18px] text-on-surface-variant/60 pointer-events-none"
              name="search"
            />
            <input
              className={`${inputClass} pl-8 pr-7 text-xs max-w-[200px] sm:max-w-xs`}
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
              className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-2xs whitespace-nowrap"
              title="Đặt lại toàn bộ lọc"
            >
              <MaterialIcon className="text-[15px]" name="filter_alt_off" />
              <span>Xóa lọc</span>
            </button>
          ) : null}

          <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">
            {filtered.length} / {employees.length} mã
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            {/* Hàng 1: Tiêu đề cột & Nút bấm sắp xếp */}
            <tr className="border-b border-[#173A67]/15">
              <th className="px-3 py-2.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("code")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Bấm để sắp xếp theo Mã NV"
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
                  title="Bấm để sắp xếp theo Họ tên"
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
                  title="Bấm để sắp xếp theo Bộ phận"
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
                  onClick={() => handleSort("reg")}
                  className="inline-flex items-center gap-1 font-bold text-[#173A67] hover:text-primary transition"
                  title="Bấm để sắp xếp theo Trạng thái tài khoản"
                >
                  <span>Tài khoản</span>
                  <MaterialIcon
                    className="text-[16px]"
                    name={
                      sortColumn === "reg"
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
                  title="Bấm để sắp xếp theo Trạng thái"
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
                      title="Xóa lọc họ tên"
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

              {/* Cột 4: Lọc Tài khoản */}
              <th className="p-2 font-normal">
                <select
                  value={regFilter}
                  onChange={(e) => setRegFilter(e.target.value)}
                  className="w-full min-w-[110px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
                >
                  <option value="all">Tất cả tài khoản</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="rejected">Bị từ chối</option>
                  <option value="unregistered">Chưa đăng ký</option>
                </select>
              </th>

              {/* Cột 5: Lọc Trạng thái hoạt động */}
              <th className="p-2 font-normal">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="w-full min-w-[100px] rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-surface outline-none focus:border-[#173A67]"
                >
                  <option value="all">Tất cả</option>
                  <option value="active">Cho phép</option>
                  <option value="inactive">Đã ngừng</option>
                </select>
              </th>

              {/* Cột 6: Thao tác & Reset filter */}
              <th className="p-2 text-right font-normal">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition shadow-2xs whitespace-nowrap"
                    title="Xóa tất cả các bộ lọc cột đang chọn"
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
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={6}>
                  Không có nhân viên phù hợp.
                </td>
              </tr>
            ) : null}
            {filtered.map((row) => {
              const isEditing = editingCode === row.employee_code;
              const isBusy = busyCode === row.employee_code;
              const registration =
                REGISTRATION_LABEL[registeredStatus[row.employee_code.toUpperCase()] ?? ""];

              return (
                <tr
                  key={row.employee_code}
                  className={`border-t border-outline-variant ${row.is_active ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3 font-semibold text-[#173A67]">{row.employee_code}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      row.full_name
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {isEditing ? (
                      <input
                        className={inputClass}
                        list="whitelistDepartments"
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                      />
                    ) : (
                      (row.department ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {registration ? (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${registration.className}`}
                      >
                        {registration.label}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant">Chưa đăng ký</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        row.is_active
                          ? "bg-[#D9F2EC] text-[#173A67]"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {row.is_active ? "Cho phép" : "Đã ngừng"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!canManage ? (
                        <span className="text-xs text-on-surface-variant">Chỉ xem</span>
                      ) : isEditing ? (
                        <>
                          <button
                            className="rounded-lg bg-tertiary px-3 py-1.5 text-xs font-bold text-on-tertiary disabled:opacity-50"
                            disabled={isBusy}
                            type="button"
                            onClick={() => void saveEdit(row)}
                          >
                            Lưu
                          </button>
                          <button
                            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface-variant"
                            disabled={isBusy}
                            type="button"
                            onClick={() => setEditingCode(null)}
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="rounded-lg border border-[#173A67] px-3 py-1.5 text-xs font-bold text-[#173A67] disabled:opacity-50"
                            disabled={isBusy}
                            type="button"
                            onClick={() => startEdit(row)}
                          >
                            Sửa
                          </button>
                          <button
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                              row.is_active
                                ? "border border-error text-error"
                                : "bg-tertiary text-on-tertiary"
                            }`}
                            disabled={isBusy}
                            type="button"
                            onClick={() => void toggleActive(row)}
                          >
                            {row.is_active ? "Ngừng" : "Kích hoạt"}
                          </button>
                        </>
                      )}
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
