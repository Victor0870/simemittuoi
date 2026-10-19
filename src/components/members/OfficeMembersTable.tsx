"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { MemberProfileSummary } from "@/lib/members/profile-server";
import {
  MARITAL_STATUS_LABEL,
  formatDateVi,
  type MaritalStatus,
} from "@/lib/members/profile-shared";

type Props = { rows: MemberProfileSummary[] };

const selectClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function OfficeMembersTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState<"all" | "complete" | "incomplete" | "empty">("all");
  const [marital, setMarital] = useState<"all" | MaritalStatus | "none">("all");

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
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr>
              <th className="px-3 py-2.5 font-bold whitespace-nowrap">Mã NV</th>
              <th className="px-3 py-2.5 font-bold">Họ tên</th>
              <th className="px-3 py-2.5 font-bold">Bộ phận</th>
              <th className="px-3 py-2.5 font-bold whitespace-nowrap">Ngày sinh</th>
              <th className="px-3 py-2.5 font-bold whitespace-nowrap">Hôn nhân</th>
              <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">Số con</th>
              <th className="px-3 py-2.5 font-bold whitespace-nowrap">Hồ sơ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={7}>
                  Không có đoàn viên phù hợp.
                </td>
              </tr>
            ) : null}
            {filtered.map((r) => {
              const complete = r.completeness_done === r.completeness_total;
              return (
                <tr key={r.id} className="border-t border-outline-variant hover:bg-surface-container-low/60">
                  <td className="px-3 py-2.5 font-semibold text-[#173A67]">{r.employee_code ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Link className="font-semibold text-[#173A67] hover:underline" href={`/office/members/${r.id}`}>
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-on-surface-variant">{r.department ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDateVi(r.date_of_birth)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.marital_status ? MARITAL_STATUS_LABEL[r.marital_status] : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">{r.children_count || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
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
