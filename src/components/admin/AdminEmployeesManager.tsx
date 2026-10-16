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

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

export function AdminEmployeesManager({ employees, registeredStatus }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const isRegistered = Boolean(registeredStatus[e.employee_code.toUpperCase()]);
      if (statusFilter === "active" && !e.is_active) return false;
      if (statusFilter === "inactive" && e.is_active) return false;
      if (statusFilter === "unregistered" && (isRegistered || !e.is_active)) return false;
      if (!q) return true;
      return (
        e.employee_code.toLowerCase().includes(q) ||
        e.full_name.toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [employees, registeredStatus, search, statusFilter]);

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

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Tìm theo mã, tên, bộ phận..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputClass} w-auto`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Tất cả</option>
          <option value="active">Đang cho phép</option>
          <option value="inactive">Đã ngừng</option>
          <option value="unregistered">Chưa đăng ký tài khoản</option>
        </select>
        <span className="text-xs text-on-surface-variant">
          {filtered.length} / {employees.length} mã
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr>
              <th className="px-4 py-3">Mã NV</th>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Bộ phận</th>
              <th className="px-4 py-3">Tài khoản</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thao tác</th>
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
                      {isEditing ? (
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
