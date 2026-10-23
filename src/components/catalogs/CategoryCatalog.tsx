"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { FINANCE_LIMITS, type CategoryKind, type FundCategory } from "@/lib/finance/registry";
import { REPORT_GROUPS, REPORT_GROUP_TITLE, reportGroupLabel } from "@/lib/finance/report-groups";
import { postCatalog } from "./post";

type Props = {
  kind: CategoryKind;
  categories: FundCategory[];
};

type CategoryDraft = {
  id?: string;
  kind: CategoryKind;
  code: string;
  name: string;
  reportGroup: string;
  isActive: boolean;
  sortOrder: number;
  systemKey: string | null;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

const SYSTEM_HINT: Record<string, string> = {
  visit: "Tự dùng khi đề nghị thanh toán chỉ gồm phiếu thăm hỏi",
  payment_default: "Tự dùng cho các đề nghị thanh toán khác (không ẩn được)",
};

/** Danh mục thu hoặc chi của sổ quỹ: thêm, sửa tên / mã / thứ tự, ẩn. */
export function CategoryCatalog({ kind, categories }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rows = categories.filter((c) => c.kind === kind);
  const label = kind === "income" ? "thu" : "chi";

  const groups = REPORT_GROUPS[kind];
  const unclassified = rows.filter((c) => c.is_active && !c.report_group).length;

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Vui lòng nhập tên danh mục.");
      return;
    }
    if (!draft.reportGroup) {
      setError(`Vui lòng chọn ${REPORT_GROUP_TITLE.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const err = await postCatalog({ action: "saveCategory", category: draft });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDraft(null);
    setMessage("Đã lưu danh mục.");
    router.refresh();
  }

  const form = draft ? (
    <div className="space-y-3 rounded-xl border border-[#173A67]/30 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_110px]">
        <div>
          <label className={labelClass}>Mã (nếu có)</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.categoryCode}
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Tên danh mục {label} *</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.categoryName}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Thứ tự</label>
          <input
            className={inputClass}
            type="number"
            value={draft.sortOrder}
            onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>{REPORT_GROUP_TITLE} *</label>
        <select
          className={`${inputClass} ${draft.reportGroup ? "" : "text-on-surface-variant"}`}
          value={draft.reportGroup}
          onChange={(e) => setDraft({ ...draft, reportGroup: e.target.value })}
        >
          <option value="">— Chọn mục trong báo cáo tổng hợp —</option>
          {groups
            .filter((g) => !g.parent)
            .map((g) =>
              g.header ? (
                <optgroup key={g.key} label={`${g.no}. ${g.label}`}>
                  {groups
                    .filter((c) => c.parent === g.key)
                    .map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.no}. {c.label}
                      </option>
                    ))}
                </optgroup>
              ) : (
                <option key={g.key} value={g.key}>
                  {g.no}. {g.label}
                </option>
              ),
            )}
        </select>
        <p className="mt-1 text-[11px] text-on-surface-variant">
          Số liệu của danh mục được cộng vào mục này trong bảng tổng hợp của trang Báo cáo tổng hợp.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          checked={draft.isActive}
          disabled={draft.systemKey === "payment_default"}
          type="checkbox"
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
        />
        Đang sử dụng (bỏ chọn để ẩn khỏi ô chọn khi ghi sổ; bút toán cũ vẫn giữ danh mục)
      </label>
      <div className="flex gap-2">
        <button
          className="rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => void save()}
        >
          Lưu danh mục
        </button>
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant"
          type="button"
          onClick={() => setDraft(null)}
        >
          Đóng
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-title-md font-bold text-[#173A67]">Danh mục {label}</h2>
          <p className="text-xs text-on-surface-variant">Dùng khi ghi phiếu {label} trong sổ quỹ và trong báo cáo thu – chi theo danh mục.</p>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
          type="button"
          onClick={() =>
            setDraft({
              kind,
              code: "",
              name: "",
              reportGroup: "",
              isActive: true,
              sortOrder: (rows.at(-1)?.sort_order ?? 0) + 5,
              systemKey: null,
            })
          }
        >
          <MaterialIcon className="text-[18px]" name="add" />
          Thêm danh mục
        </button>
      </div>
      {unclassified ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Có {unclassified} danh mục đang dùng chưa chọn {REPORT_GROUP_TITLE.toLowerCase()} – số liệu của chúng sẽ nằm ở dòng
          “Chưa phân loại” trong báo cáo. Bấm “Sửa” để chọn.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-error-container">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div>
      ) : null}
      {draft && !draft.id ? form : null}
      <ul className="divide-y divide-outline-variant">
        {rows.map((c) => (
          <li key={c.id} className="py-2">
            {draft?.id === c.id ? (
              form
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[200px] flex-1">
                  <p className={`text-sm font-semibold ${c.is_active ? "" : "text-on-surface-variant line-through"}`}>
                    {c.code ? <span className="mr-1 text-on-surface-variant">{c.code}</span> : null}
                    {c.name}
                  </p>
                  {c.report_group ? (
                    <p className="text-[11px] text-on-surface-variant">Báo cáo: {reportGroupLabel(c.report_group)}</p>
                  ) : (
                    <p className="text-[11px] font-semibold text-amber-700">Chưa chọn {REPORT_GROUP_TITLE.toLowerCase()}</p>
                  )}
                  {c.system_key ? <p className="text-[11px] text-sky-800">{SYSTEM_HINT[c.system_key]}</p> : null}
                </div>
                <button
                  className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      kind: c.kind,
                      code: c.code ?? "",
                      name: c.name,
                      reportGroup: c.report_group ?? "",
                      isActive: c.is_active,
                      sortOrder: c.sort_order,
                      systemKey: c.system_key,
                    })
                  }
                >
                  <MaterialIcon className="text-[16px]" name="edit" />
                  Sửa
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
