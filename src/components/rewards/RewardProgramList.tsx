"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { VisitStatusBadge } from "@/components/visits/VisitStatusBadge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PaymentStatus } from "@/lib/payments/registry";
import { VISIT_STATUS_LABEL } from "@/lib/visits/registry";

export type RewardProgramRow = {
  id: string;
  title: string;
  closedAt: string | null;
  hasRewardMoney: boolean;
  payment: { id: string; code: string; status: PaymentStatus } | null;
};

type Props = {
  programs: RewardProgramRow[];
  /** Có quyền xem đề nghị thanh toán – hiện liên kết tới đề nghị. */
  paymentLinkable: boolean;
};

type Tab = "pending" | "linked" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Chưa lập đề nghị" },
  { key: "linked", label: "Đã lập đề nghị" },
  { key: "all", label: "Tất cả" },
];

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const detailHref = (id: string) => `/admin/administration/rewards/${encodeURIComponent(id)}`;

function fold(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function RewardProgramList({ programs, paymentLinkable }: Props) {
  const [tab, setTab] = useState<Tab>(programs.some((p) => !p.payment) ? "pending" : "all");
  const [search, setSearch] = useState("");

  const counts: Record<Tab, number> = useMemo(
    () => ({
      pending: programs.filter((p) => !p.payment).length,
      linked: programs.filter((p) => p.payment).length,
      all: programs.length,
    }),
    [programs],
  );

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return programs.filter((p) => {
      if (tab === "pending" && p.payment) return false;
      if (tab === "linked" && !p.payment) return false;
      if (q && !fold([p.title, p.payment?.code].filter(Boolean).join(" ")).includes(q)) return false;
      return true;
    });
  }, [programs, tab, search]);

  const columns: DataTableColumn<RewardProgramRow>[] = [
    {
      key: "title",
      header: "Chương trình",
      render: (p) => (
        <Link prefetch={false} className="font-bold text-[#173A67] hover:underline" href={detailHref(p.id)}>
          {p.title}
        </Link>
      ),
    },
    {
      key: "closedAt",
      header: "Kết thúc",
      type: "date",
      className: "whitespace-nowrap",
      render: (p) => (p.closedAt ? new Date(p.closedAt).toLocaleDateString("vi-VN") : "—"),
    },
    {
      key: "hasRewardMoney",
      header: "Tiền thưởng",
      type: "enum",
      accessor: (p) => (p.hasRewardMoney ? "Đã cài" : "Chưa cài"),
      render: (p) =>
        p.hasRewardMoney ? (
          <span className="inline-flex rounded-full bg-[#D9F2EC] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-[#173A67]">
            Đã cài
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-amber-900">
            Chưa cài
          </span>
        ),
    },
    {
      key: "payment",
      header: "Đề nghị thanh toán",
      type: "enum",
      accessor: (p) => (p.payment ? `${p.payment.code} – ${VISIT_STATUS_LABEL[p.payment.status]}` : "Chưa lập"),
      render: (p) =>
        p.payment ? (
          <span className="inline-flex flex-wrap items-center gap-2 whitespace-nowrap">
            {paymentLinkable ? (
              <Link
                prefetch={false}
                className="font-semibold text-[#173A67] hover:underline"
                href={`/admin/administration/payments/${p.payment.id}`}
              >
                {p.payment.code}
              </Link>
            ) : (
              <span className="font-semibold">{p.payment.code}</span>
            )}
            <VisitStatusBadge status={p.payment.status} />
          </span>
        ) : (
          <span className="text-on-surface-variant">Chưa lập</span>
        ),
    },
    {
      key: "action",
      header: "",
      filterable: false,
      className: "text-right",
      render: (p) => (
        <Link
          prefetch={false}
          className="inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-[#173A67] transition hover:border-[#173A67]"
          href={detailHref(p.id)}
        >
          <MaterialIcon className="text-[16px]" name="list_alt" />
          Danh sách thưởng
        </Link>
      ),
    },
  ];

  if (programs.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
        Chưa có chương trình nào kết thúc.
      </p>
    );
  }

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
            <span className={`ml-1.5 ${t.key === "pending" && counts.pending ? "text-amber-400" : "opacity-70"}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <MaterialIcon
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
          name="search"
        />
        <input
          className={`${inputClass} w-full pl-9`}
          placeholder="Tìm theo tên chương trình, số đề nghị..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        emptyText={tab === "pending" ? "Mọi chương trình đã lập đề nghị thanh toán." : "Không có chương trình phù hợp."}
        rowKey={(p) => p.id}
        rows={filtered}
      />
    </div>
  );
}
