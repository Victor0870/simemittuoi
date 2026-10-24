"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  MEMBER_EXPORT_COLUMNS,
  MEMBER_EXPORT_DETAIL_COLUMNS,
  MEMBER_TABLE_COLUMNS,
  MEMBER_TABLE_COLUMN_LABEL,
  MEMBER_TABLE_DEFAULT_COLUMNS,
  isMemberTableColumn,
  type MemberExportColumnKey,
  type MemberTableColumnKey,
} from "@/lib/members/member-columns";
import type { MemberProfileSummary } from "@/lib/members/profile-server";
import {
  DETAIL_FIELD_LABEL,
  GENDER_LABEL,
  MARITAL_STATUS_LABEL,
  formatDateVi,
  type MaritalStatus,
} from "@/lib/members/profile-shared";

type Props = { rows: MemberProfileSummary[]; canExport?: boolean };

const selectClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const toolbarButtonClass =
  "inline-flex items-center gap-1.5 rounded-xl border border-[#d2dfe9] px-3 py-2 text-sm font-semibold transition";

const COLUMNS_STORAGE_KEY = "cdilv.officeMembers.columns";

/** Cột bảng mặc định + mọi thông tin chi tiết (chỉ có trong file Excel). */
const DEFAULT_SELECTED_COLUMNS: MemberExportColumnKey[] = [
  ...MEMBER_TABLE_DEFAULT_COLUMNS,
  ...MEMBER_EXPORT_DETAIL_COLUMNS,
];

const updatedAtFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function readStoredColumns(): MemberExportColumnKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    if (!Array.isArray(parsed)) return null;
    const keys = MEMBER_EXPORT_COLUMNS.filter((k) => parsed.includes(k));
    return keys.some(isMemberTableColumn) ? keys : null;
  } catch {
    return null;
  }
}

function writeStoredColumns(keys: MemberExportColumnKey[]) {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Trình duyệt chặn localStorage: vẫn dùng được, chỉ không nhớ lựa chọn.
  }
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function ColumnChooser({
  selected,
  showExportFields,
  onChange,
}: {
  selected: MemberExportColumnKey[];
  showExportFields: boolean;
  onChange: (keys: MemberExportColumnKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleCount = selected.filter(isMemberTableColumn).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(key: MemberExportColumnKey) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : MEMBER_EXPORT_COLUMNS.filter((k) => k === key || selected.includes(k));
    if (!next.some(isMemberTableColumn)) return;
    onChange(next);
  }

  function renderOption(key: MemberExportColumnKey, label: string) {
    const checked = selected.includes(key);
    const locked = checked && isMemberTableColumn(key) && visibleCount === 1;
    return (
      <li key={key}>
        <label
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#ecf4ff]"
          }`}
          title={locked ? "Cần giữ ít nhất 1 cột hiển thị" : undefined}
        >
          <input
            checked={checked}
            className="h-4 w-4 accent-[#4a6b82]"
            disabled={locked}
            type="checkbox"
            onChange={() => toggle(key)}
          />
          <span className="text-[#173A67]">{label}</span>
        </label>
      </li>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${toolbarButtonClass} bg-white text-[#4a6b82] hover:bg-[#ecf4ff]`}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <MaterialIcon className="text-[18px]" name="view_column" />
        <span>Cột hiển thị</span>
        <span className="text-xs font-normal text-on-surface-variant">
          {visibleCount}/{MEMBER_TABLE_COLUMNS.length}
        </span>
      </button>
      {open ? (
        <div
          aria-label="Chọn cột hiển thị"
          className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[#d2dfe9] bg-white p-3 text-sm shadow-lg"
          role="dialog"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
            <button
              className="text-[#4a6b82] hover:text-[#173A67] hover:underline"
              type="button"
              onClick={() => onChange([...MEMBER_EXPORT_COLUMNS])}
            >
              Hiện tất cả
            </button>
            <button
              className="text-[#4a6b82] hover:text-[#173A67] hover:underline"
              type="button"
              onClick={() => onChange([...DEFAULT_SELECTED_COLUMNS])}
            >
              Mặc định
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <ul className="space-y-0.5">
              {MEMBER_TABLE_COLUMNS.map((key) => renderOption(key, MEMBER_TABLE_COLUMN_LABEL[key]))}
            </ul>
            {showExportFields ? (
              <>
                <p className="mt-3 mb-1 border-t border-[#d2dfe9] px-2 pt-2 text-xs font-semibold text-on-surface-variant">
                  Chỉ có trong file Excel
                </p>
                <ul className="space-y-0.5">
                  {MEMBER_EXPORT_DETAIL_COLUMNS.map((key) => renderOption(key, DETAIL_FIELD_LABEL[key]))}
                </ul>
              </>
            ) : null}
          </div>
          <p className="mt-2 px-2 text-[11px] text-on-surface-variant">Cần giữ ít nhất 1 cột hiển thị.</p>
        </div>
      ) : null}
    </div>
  );
}

export function OfficeMembersTable({ rows, canExport = false }: Props) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState<"all" | "complete" | "incomplete" | "empty">("all");
  const [marital, setMarital] = useState<"all" | MaritalStatus | "none">("all");
  const [selectedColumns, setSelectedColumns] = useState<MemberExportColumnKey[]>(DEFAULT_SELECTED_COLUMNS);

  useEffect(() => {
    const stored = readStoredColumns();
    if (stored) setSelectedColumns(stored);
  }, []);

  function updateSelectedColumns(keys: MemberExportColumnKey[]) {
    setSelectedColumns(keys);
    writeStoredColumns(keys);
  }

  const departments = useMemo(
    () =>
      [...new Set(rows.map((r) => r.department?.trim()).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [rows],
  );

  const stats = useMemo(() => {
    const complete = rows.filter((r) => r.completeness_done === r.completeness_total).length;
    const empty = rows.filter((r) => r.completeness_done === 0 && r.children_count === 0).length;
    return {
      total: rows.length,
      complete,
      incomplete: rows.length - complete,
      empty,
      children: rows.reduce((sum, r) => sum + r.children_count, 0),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = removeVietnameseTones(search.trim());
    return rows.filter((r) => {
      if (q) {
        const hay = removeVietnameseTones(`${r.full_name} ${r.employee_code ?? ""} ${r.department ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      if (dept !== "all" && (r.department?.trim() ?? "") !== dept) return false;
      const isComplete = r.completeness_done === r.completeness_total;
      if (status === "complete" && !isComplete) return false;
      if (status === "incomplete" && isComplete) return false;
      if (status === "empty" && !(r.completeness_done === 0 && r.children_count === 0)) return false;
      if (marital === "none" && r.marital_status) return false;
      if (marital !== "all" && marital !== "none" && r.marital_status !== marital) return false;
      return true;
    });
  }, [rows, search, dept, status, marital]);

  const allColumns: (DataTableColumn<MemberProfileSummary> & { key: MemberTableColumnKey })[] = [
    {
      key: "employee_code",
      header: MEMBER_TABLE_COLUMN_LABEL.employee_code,
      className: "font-semibold text-[#173A67] whitespace-nowrap",
      render: (r) => r.employee_code ?? "—",
    },
    {
      key: "full_name",
      header: MEMBER_TABLE_COLUMN_LABEL.full_name,
      render: (r) => (
        <Link className="font-semibold text-[#173A67] hover:underline" href={`/office/members/${r.id}`}>
          {r.full_name}
        </Link>
      ),
    },
    {
      key: "department",
      header: MEMBER_TABLE_COLUMN_LABEL.department,
      type: "enum",
      className: "text-on-surface-variant",
      render: (r) => r.department ?? "—",
    },
    {
      key: "date_of_birth",
      header: MEMBER_TABLE_COLUMN_LABEL.date_of_birth,
      type: "date",
      className: "whitespace-nowrap",
      render: (r) => formatDateVi(r.date_of_birth),
    },
    {
      key: "gender",
      header: MEMBER_TABLE_COLUMN_LABEL.gender,
      type: "enum",
      accessor: (r) => (r.gender ? GENDER_LABEL[r.gender] : null),
      className: "whitespace-nowrap",
      render: (r) => (r.gender ? GENDER_LABEL[r.gender] : "—"),
    },
    {
      key: "marital_status",
      header: MEMBER_TABLE_COLUMN_LABEL.marital_status,
      type: "enum",
      accessor: (r) => (r.marital_status ? MARITAL_STATUS_LABEL[r.marital_status] : null),
      className: "whitespace-nowrap",
      headerClassName: "whitespace-nowrap",
      render: (r) => (r.marital_status ? MARITAL_STATUS_LABEL[r.marital_status] : "—"),
    },
    {
      key: "children_count",
      header: MEMBER_TABLE_COLUMN_LABEL.children_count,
      type: "number",
      className: "text-center",
      headerClassName: "text-center",
      render: (r) => r.children_count || "—",
    },
    {
      key: "has_identity",
      header: MEMBER_TABLE_COLUMN_LABEL.has_identity,
      type: "enum",
      accessor: (r) => (r.has_identity ? "Đã khai" : "Chưa khai"),
      className: "whitespace-nowrap",
      render: (r) => (r.has_identity ? "Đã khai" : <span className="text-on-surface-variant">Chưa khai</span>),
    },
    {
      key: "completeness",
      header: MEMBER_TABLE_COLUMN_LABEL.completeness,
      type: "enum",
      accessor: (r) =>
        r.completeness_done === r.completeness_total ? "Đã khai đủ" : r.completeness_done === 0 ? "Chưa khai" : "Chưa đủ",
      className: "whitespace-nowrap",
      render: (r) => {
        const complete = r.completeness_done === r.completeness_total;
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-bold ${
              complete
                ? "bg-[#D9F2EC] text-[#173A67]"
                : r.completeness_done === 0
                  ? "bg-error-container text-on-error-container"
                  : "bg-amber-100 text-amber-900"
            }`}
            title={r.missing.length ? `Còn thiếu: ${r.missing.join(", ")}` : "Đã khai đủ"}
          >
            {complete ? "Đủ" : `${r.completeness_done}/${r.completeness_total}`}
          </span>
        );
      },
    },
    {
      key: "missing",
      header: MEMBER_TABLE_COLUMN_LABEL.missing,
      accessor: (r) => r.missing.join(", "),
      className: "min-w-[200px] text-xs text-on-surface-variant",
      render: (r) => r.missing.join(", ") || "—",
    },
    {
      key: "updated_at",
      header: MEMBER_TABLE_COLUMN_LABEL.updated_at,
      type: "date",
      className: "whitespace-nowrap",
      render: (r) => (r.updated_at ? updatedAtFormat.format(new Date(r.updated_at)) : "—"),
    },
  ];

  const columns = allColumns.filter((c) => selectedColumns.includes(c.key));
  const exportHref = `/api/members/export?cols=${MEMBER_EXPORT_COLUMNS.filter((k) => selectedColumns.includes(k)).join(",")}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Đoàn viên", value: stats.total },
          { label: "Đã khai đủ", value: stats.complete },
          { label: "Chưa đủ", value: stats.incomplete, hint: `${stats.empty} chưa khai gì` },
          { label: "Tổng số con đã khai", value: stats.children },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="text-xs text-on-surface-variant">{s.label}</p>
            <p className="text-headline-sm font-bold text-[#173A67]">{s.value}</p>
            {s.hint ? <p className="text-[11px] text-on-surface-variant">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MaterialIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
            name="search"
          />
          <input
            className={`${selectClass} w-full pl-9`}
            placeholder="Tìm theo tên, mã NV, bộ phận..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">Mọi bộ phận</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">Mọi tình trạng hồ sơ</option>
          <option value="complete">Đã khai đủ</option>
          <option value="incomplete">Chưa đủ</option>
          <option value="empty">Chưa khai gì</option>
        </select>
        <select
          className={selectClass}
          value={marital}
          onChange={(e) => setMarital(e.target.value as typeof marital)}
        >
          <option value="all">Mọi tình trạng hôn nhân</option>
          {(Object.keys(MARITAL_STATUS_LABEL) as MaritalStatus[]).map((m) => (
            <option key={m} value={m}>
              {MARITAL_STATUS_LABEL[m]}
            </option>
          ))}
          <option value="none">Chưa khai</option>
        </select>
        <span className="text-xs font-semibold text-on-surface-variant">
          {filtered.length} / {rows.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ColumnChooser
            selected={selectedColumns}
            showExportFields={canExport}
            onChange={updateSelectedColumns}
          />
          {canExport ? (
            <a
              className={`${toolbarButtonClass} border-[#4a6b82] bg-[#4a6b82] text-white hover:bg-[#173A67]`}
              href={exportHref}
              title="Tải danh sách hồ sơ toàn bộ đoàn viên đã duyệt theo các cột đã chọn (số CCCD được che)"
            >
              <MaterialIcon className="text-[18px]" name="download" />
              <span>Xuất Excel</span>
            </a>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        emptyText="Không có đoàn viên phù hợp."
        rowKey={(r) => r.id}
        rows={filtered}
      />
    </div>
  );
}
