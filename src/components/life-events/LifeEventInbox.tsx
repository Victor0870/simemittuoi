"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBadge, StatusBadge } from "@/components/life-events/LifeEventBadges";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { formatDateTimeVi } from "@/lib/data/albums";
import {
  LIFE_EVENT_CATEGORIES,
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
          {LIFE_EVENT_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.short}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-on-surface-variant">{filtered.length} tin</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-bold [&>th]:whitespace-nowrap">
              <th>Số phiếu</th>
              <th>Đoàn viên</th>
              <th>Nhóm</th>
              <th>Sự việc</th>
              <th>Ngày xảy ra</th>
              <th className="text-center">Giấy tờ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={7}>
                  {tab === "submitted" ? "Không có tin nào đang chờ tiếp nhận." : "Không có tin phù hợp."}
                </td>
              </tr>
            ) : null}
            {filtered.map((i) => (
              <tr
                key={i.id}
                className={`border-t border-outline-variant hover:bg-surface-container-low/60 [&>td]:px-3 [&>td]:py-2.5 ${
                  i.status === "submitted" ? "bg-amber-50/40" : ""
                }`}
              >
                <td className="whitespace-nowrap">
                  <Link className="font-bold text-[#173A67] hover:underline" href={`/life-events/${i.id}`}>
                    {i.code}
                  </Link>
                  <p className="text-[11px] text-on-surface-variant">{formatDateTimeVi(i.created_at)}</p>
                </td>
                <td>
                  <p className="font-semibold">{i.member?.full_name ?? "—"}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {[i.member?.employee_code, i.member?.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                </td>
                <td>
                  <CategoryBadge category={i.category} />
                </td>
                <td>
                  <p className="font-semibold">{TYPE_BY_CODE[i.event_type]?.label ?? i.event_type}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {describeSubject(i.subject_relation, i.subject_name)}
                  </p>
                </td>
                <td className="whitespace-nowrap">{formatDateVi(i.event_date)}</td>
                <td className="text-center">{i.attachment_count || "—"}</td>
                <td>
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
