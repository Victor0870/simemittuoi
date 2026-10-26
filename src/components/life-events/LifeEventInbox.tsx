"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { CategoryBadge, StatusBadge } from "@/components/life-events/LifeEventBadges";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import {
  CATEGORY_BY_KEY,
  LIFE_EVENT_CATEGORIES,
  STATUS_LABEL,
  TYPE_BY_CODE,
  describeSubject,
  type LifeEventCategory,
  type LifeEventStatus,
} from "@/lib/life-events/registry";
import type { LifeEventListItem } from "@/lib/life-events/server";
import { formatDateVi } from "@/lib/members/profile-shared";

type Props = { items: LifeEventListItem[] };

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const TABS: { key: LifeEventStatus | "all"; label: string }[] = [
  { key: "submitted", label: "Chờ tiếp nhận" },
  { key: "acknowledged", label: "Đã tiếp nhận" },
  { key: "withdrawn", label: "Đã rút" },
  { key: "all", label: "Tất cả" },
];

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function LifeEventInbox({ items }: Props) {
  const [tab, setTab] = useState<LifeEventStatus | "all">("submitted");
  const [category, setCategory] = useState<LifeEventCategory | "all">("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, submitted: 0, acknowledged: 0, withdrawn: 0 };
    for (const i of items) c[i.status] += 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = removeVietnameseTones(search.trim());
    return items.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false;
      if (category !== "all" && i.category !== category) return false;
      if (q) {
        const hay = removeVietnameseTones(
          [i.code, i.member?.full_name, i.member?.employee_code, i.member?.department, i.subject_name]
            .filter(Boolean)
            .join(" "),
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, tab, category, search]);

  const columns: DataTableColumn<LifeEventListItem>[] = [
    {
      key: "code",
      header: "Số phiếu",
      className: "whitespace-nowrap",
      render: (i) => (
        <>
          <Link className="font-bold text-[#173A67] hover:underline" href={`/admin/administration/life-events/${i.id}`}>
            {i.code}
          </Link>
          <p className="text-[11px] text-on-surface-variant">{formatDateTimeVi(i.created_at)}</p>
        </>
      ),
    },
    {
      key: "member",
      header: "Đoàn viên",
      accessor: (i) => i.member?.full_name ?? null,
      render: (i) => (
        <>
          <p className="font-semibold">{i.member?.full_name ?? "—"}</p>
          <p className="text-[11px] text-on-surface-variant">
            {[i.member?.employee_code, i.member?.department].filter(Boolean).join(" · ") || "—"}
          </p>
        </>
      ),
    },
    {
      key: "category",
      header: "Nhóm",
      type: "enum",
      accessor: (i) => CATEGORY_BY_KEY[i.category]?.short ?? i.category,
      render: (i) => <CategoryBadge category={i.category} />,
    },
    {
      key: "event_type",
      header: "Sự việc",
      accessor: (i) => TYPE_BY_CODE[i.event_type]?.label ?? i.event_type,
      render: (i) => (
        <>
          <p className="font-semibold">{TYPE_BY_CODE[i.event_type]?.label ?? i.event_type}</p>
          <p className="text-[11px] text-on-surface-variant">
            {describeSubject(i.subject_relation, i.subject_name)}
          </p>
        </>
      ),
    },
    {
      key: "event_date",
      header: "Ngày xảy ra",
      type: "date",
      className: "whitespace-nowrap",
      render: (i) => formatDateVi(i.event_date),
    },
    {
      key: "attachment_count",
      header: "Giấy tờ",
      className: "text-center",
      headerClassName: "text-center",
      render: (i) => i.attachment_count || "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      type: "enum",
      accessor: (i) => STATUS_LABEL[i.status],
      render: (i) => <StatusBadge status={i.status} />,
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
            <span className={`ml-1.5 ${t.key === "submitted" && counts.submitted ? "text-amber-400" : "opacity-70"}`}>
              {counts[t.key]}
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
            placeholder="Tìm theo số phiếu, tên, mã NV, bộ phận..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value as LifeEventCategory | "all")}
        >
          <option value="all">Mọi nhóm tin</option>
          {LIFE_EVENT_CATEGORIES.filter((c) => c.memberSubmittable || items.some((i) => i.category === c.key)).map((c) => (
            <option key={c.key} value={c.key}>
              {c.short}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-on-surface-variant">{filtered.length} tin</span>
      </div>

      <DataTable
        columns={columns}
        emptyText={tab === "submitted" ? "Không có tin nào đang chờ tiếp nhận." : "Không có tin phù hợp."}
        rowClassName={(i) => (i.status === "submitted" ? "bg-amber-50/40" : "")}
        rowKey={(i) => i.id}
        rows={filtered}
      />
    </div>
  );
}
