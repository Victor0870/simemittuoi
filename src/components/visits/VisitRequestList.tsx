"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import { VISIT_STATUS_LABEL, formatVnd, type VisitStatus } from "@/lib/visits/registry";
import type { VisitRequestListItem } from "@/lib/visits/server";

type Props = { items: VisitRequestListItem[] };

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const TABS: { key: VisitStatus | "all"; label: string }[] = [
  { key: "proposed", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt – chờ chi" },
  { key: "paid", label: "Đã chi" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
  { key: "all", label: "Tất cả" },
];

function fold(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function VisitRequestList({ items }: Props) {
  const [tab, setTab] = useState<VisitStatus | "all">(items.some((i) => i.status === "proposed") ? "proposed" : "all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");

  const years = useMemo(
    () => [...new Set(items.map((i) => i.created_at.slice(0, 4)))].sort().reverse(),
    [items],
  );

  const inYear = useMemo(
    () => (year === "all" ? items : items.filter((i) => i.created_at.startsWith(year))),
    [items, year],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inYear.length };
    for (const i of inYear) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [inYear]);

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return inYear.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false;
      if (q) {
        const hay = fold([i.code, i.member_name, i.member_employee_code, i.member_department, i.reason].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inYear, tab, search]);

  const total = filtered.reduce((sum, i) => sum + i.amount, 0);

  const columns: DataTableColumn<VisitRequestListItem>[] = [
    {
      key: "code",
      header: "Số phiếu",
      className: "whitespace-nowrap",
      render: (i) => (
        <>
          <Link className="font-bold text-[#173A67] hover:underline" href={`/office/visits/${i.id}`}>
            {i.code}
          </Link>
          <p className="text-[11px] text-on-surface-variant">{formatDateTimeVi(i.created_at)}</p>
        </>
      ),
    },
    {
      key: "member_name",
      header: "Đoàn viên",
      render: (i) => (
        <>
          <p className="font-semibold">{i.member_name}</p>
          <p className="text-[11px] text-on-surface-variant">
            {[i.member_employee_code, i.member_department].filter(Boolean).join(" · ")}
          </p>
        </>
      ),
    },
    {
      key: "reason",
      header: "Lý do",
      className: "max-w-[320px]",
      render: (i) => (
        <>
          <p className="line-clamp-2">{i.reason}</p>
          {i.life_event_code ? <p className="text-[11px] text-on-surface-variant">Từ tin báo {i.life_event_code}</p> : null}
        </>
      ),
    },
    {
      key: "amount",
      header: "Số tiền",
      type: "number",
      className: "text-right font-bold whitespace-nowrap",
      headerClassName: "text-right",
      render: (i) => formatVnd(i.amount),
    },
    {
      key: "creator_name",
      header: "Người lập",
      type: "enum",
      className: "whitespace-nowrap",
      render: (i) => i.creator_name ?? "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      type: "enum",
      accessor: (i) => VISIT_STATUS_LABEL[i.status],
      render: (i) => <VisitStatusBadge status={i.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
              tab === t.key
                ? "bg-[#173A67] text-white"
                : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
            }`}
            type="button"
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={`ml-1.5 ${t.key === "proposed" && counts.proposed ? "text-amber-400" : "opacity-70"}`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MaterialIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
            name="search"
          />
          <input
            className={`${inputClass} w-full pl-9`}
            placeholder="Tìm theo số phiếu, tên, mã NV, bộ phận, lý do..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">Mọi năm</option>
          {years.map((y) => (
            <option key={y} value={y}>
              Năm {y}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-on-surface-variant">
          {filtered.length} phiếu · {formatVnd(total)}
        </span>
      </div>

      <DataTable
        columns={columns}
        emptyText={tab === "proposed" ? "Không có đề nghị nào đang chờ duyệt." : "Không có phiếu phù hợp."}
        footerNote={
          filtered.length > 0 ? (
            <span className="not-italic font-bold text-[#173A67]">
              Tổng cộng ({filtered.length} phiếu): {formatVnd(total)}
            </span>
          ) : null
        }
        rowClassName={(i) => (i.status === "proposed" ? "bg-amber-50/40" : "")}
        rowKey={(i) => i.id}
        rows={filtered}
      />
    </div>
  );
}
