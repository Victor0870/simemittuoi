"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  ENTRY_KIND_LABEL,
  FINANCE_LIMITS,
  parseEntryInput,
  type EntryKind,
  type Fund,
  type FundCategory,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { vndInWords } from "@/lib/print/vn-money";

export type EntryFormValues = {
  kind: EntryKind;
  entryDate: string;
  fundId: string;
  toFundId: string;
  categoryId: string;
  amount: string;
  description: string;
  counterparty: string;
  documentNo: string;
};

type Props = {
  mode: "create" | "edit";
  initial: EntryFormValues;
  funds: Fund[];
  categories: FundCategory[];
  lockedThrough: string | null;
  entryId?: string;
  onCancel?: () => void;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

const KIND_ICON: Record<EntryKind, string> = { income: "south_west", expense: "north_east", transfer: "swap_horiz" };

export function FundEntryForm({ mode, initial, funds, categories, lockedThrough, entryId, onCancel }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<EntryFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<EntryFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const amount = Number(values.amount.replace(/\D/g, "")) || 0;
  const usableFunds = funds.filter((f) => f.is_active || f.id === initial.fundId || f.id === initial.toFundId);
  const usableCategories = categories.filter(
    (c) => c.kind === values.kind && (c.is_active || c.id === initial.categoryId),
  );
  const locked = Boolean(lockedThrough && values.entryDate && values.entryDate <= lockedThrough);

  async function submit() {
    const payload = { ...values, amount };
    const parsed = parseEntryInput(payload);
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/finance/entries" : `/api/finance/entries/${entryId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không lưu được bút toán.");
        return;
      }
      if (mode === "create") router.push(`/office/finance/${data.id}?created=1`);
      else {
        router.refresh();
        onCancel?.();
      }
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      {mode === "create" ? (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ENTRY_KIND_LABEL) as EntryKind[]).map((k) => (
            <button
              key={k}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-bold ${
                values.kind === k
                  ? "bg-[#173A67] text-white"
                  : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
              }`}
              type="button"
              onClick={() => set({ kind: k, categoryId: "" })}
            >
              <MaterialIcon className="text-[18px]" name={KIND_ICON[k]} />
              {ENTRY_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Ngày ghi sổ *</label>
          <input className={inputClass} type="date" value={values.entryDate} onChange={(e) => set({ entryDate: e.target.value })} />
          {locked ? (
            <p className="mt-1 text-xs text-rose-700">Ngày này thuộc kỳ đã khóa sổ (đến hết {formatDateVi(lockedThrough!)}).</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Số tiền (VNĐ) *</label>
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder="0"
            value={values.amount ? new Intl.NumberFormat("vi-VN").format(amount) : ""}
            onChange={(e) => set({ amount: e.target.value.replace(/\D/g, "").slice(0, 12) })}
          />
          {amount > 0 ? <p className="mt-1 text-xs text-on-surface-variant">{vndInWords(amount)}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{values.kind === "transfer" ? "Từ quỹ *" : "Quỹ *"}</label>
          <select className={inputClass} value={values.fundId} onChange={(e) => set({ fundId: e.target.value })}>
            <option value="">— Chọn quỹ —</option>
            {usableFunds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        {values.kind === "transfer" ? (
          <div>
            <label className={labelClass}>Sang quỹ *</label>
            <select className={inputClass} value={values.toFundId} onChange={(e) => set({ toFundId: e.target.value })}>
              <option value="">— Chọn quỹ nhận —</option>
              {usableFunds
                .filter((f) => f.id !== values.fundId)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Danh mục {values.kind === "income" ? "thu" : "chi"} *</label>
            <select className={inputClass} value={values.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">— Chọn danh mục —</option>
              {usableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Diễn giải *</label>
        <input
          className={inputClass}
          maxLength={FINANCE_LIMITS.description}
          placeholder={
            values.kind === "income"
              ? "Ví dụ: Thu đoàn phí tháng 10/2026"
              : values.kind === "expense"
                ? "Ví dụ: Mua quà Trung thu cho con đoàn viên"
                : "Ví dụ: Rút tiền gửi về quỹ tiền mặt"
          }
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {values.kind !== "transfer" ? (
          <div>
            <label className={labelClass}>{values.kind === "income" ? "Người nộp tiền" : "Người nhận tiền"}</label>
            <input
              className={inputClass}
              maxLength={FINANCE_LIMITS.name}
              value={values.counterparty}
              onChange={(e) => set({ counterparty: e.target.value })}
            />
          </div>
        ) : null}
        <div>
          <label className={labelClass}>Số chứng từ gốc</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.documentNo}
            placeholder="Hóa đơn, giấy đề nghị, ủy nhiệm chi…"
            value={values.documentNo}
            onChange={(e) => set({ documentNo: e.target.value })}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
          disabled={busy || locked}
          type="button"
          onClick={() => void submit()}
        >
          <MaterialIcon className="text-[18px]" name={busy ? "progress_activity" : "save"} />
          {mode === "create" ? `Ghi ${ENTRY_KIND_LABEL[values.kind].toLowerCase()}` : "Lưu thay đổi"}
        </button>
        {onCancel ? (
          <button
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-[#173A67]"
            disabled={busy}
            type="button"
            onClick={onCancel}
          >
            Hủy
          </button>
        ) : null}
      </div>
    </div>
  );
}
