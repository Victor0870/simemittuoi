"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateVi } from "@/lib/members/profile-shared";
import { PAYMENT_METHOD_LABEL, type PaymentStatus } from "@/lib/payments/registry";
import type { PaymentRequestListItem } from "@/lib/payments/server";
import { VISIT_STATUS_LABEL, formatVnd } from "@/lib/visits/registry";

type Props = { items: PaymentRequestListItem[] };

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const TABS: { key: PaymentStatus | "all"; label: string }[] = [
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

export function PaymentRequestList({ items }: Props) {
  const [tab, setTab] = useState<PaymentStatus | "all">(items.some((i) => i.status === "proposed") ? "proposed" : "all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");

  const years = useMemo(() => [...new Set(items.map((i) => i.request_date.slice(0, 4)))].sort().reverse(), [items]);

  const inYear = useMemo(
    () => (year === "all" ? items : items.filter((i) => i.request_date.startsWith(year))),
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
        const hay = fold([i.code, i.title, i.requester_name, i.receiver_name].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inYear, tab, search]);

  const total = filtered.reduce((sum, i) => sum + i.total_amount, 0);

  const columns: DataTableColumn<PaymentRequestListItem>[] = [
    {
      key: "code",
      header: "Số đề nghị",
      className: "whitespace-nowrap",
      render: (i) => (
        <>
          <Link className="font-bold text-[#173A67] hover:underline" href={`/office/payments/${i.id}`}>
            {i.code}
          </Link>
          <p className="text-[11px] text-on-surface-variant">{formatDateVi(i.request_date)}</p>
        </>
      ),
    },
    {
      key: "title",
      header: "Nội dung",
      className: "max-w-[320px]",
      render: (i) => (
        <>
          <p className="line-clamp-2 font-semibold">{i.title}</p>
          <p className="text-[11px] text-on-surface-variant">
            {i.item_count} dòng · {i.requester_name}
          </p>
        </>
      ),
    },
    {
      key: "receiver_name",
      header: "Người nhận",
      render: (i) => (
        <>
          <p>{i.receiver_name ?? "—"}</p>
          <p className="text-[11px] text-on-surface-variant">{PAYMENT_METHOD_LABEL[i.payment_method]}</p>
        </>
      ),
    },
    {
      key: "total_amount",
      header: "Số tiền",
      type: "number",
      className: "text-right font-bold whitespace-nowrap",
      headerClassName: "text-right",
      render: (i) => formatVnd(i.total_amount),
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
            placeholder="Tìm theo số đề nghị, nội dung, người đề nghị, người nhận..."
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
          {filtered.length} đề nghị · {formatVnd(total)}
        </span>
      </div>

      <DataTable
        columns={columns}
        emptyText={tab === "proposed" ? "Không có đề nghị nào đang chờ duyệt." : "Không có đề nghị phù hợp."}
        footerNote={
          filtered.length > 0 ? (
            <span className="not-italic font-bold text-[#173A67]">
              Tổng cộng ({filtered.length} đề nghị): {formatVnd(total)}
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
