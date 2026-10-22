"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  FINANCE_LIMITS,
  FUND_KIND_LABEL,
  endOfPreviousMonth,
  type CategoryKind,
  type Fund,
  type FundCategory,
  type FundKind,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  funds: Fund[];
  categories: FundCategory[];
  lockedThrough: string | null;
  today: string;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

type FundDraft = {
  id?: string;
  kind: FundKind;
  name: string;
  bankAccountNo: string;
  bankName: string;
  openingBalance: string;
  openingDate: string;
  isActive: boolean;
  sortOrder: number;
};

type CategoryDraft = {
  id?: string;
  kind: CategoryKind;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  systemKey: string | null;
};

const SYSTEM_HINT: Record<string, string> = {
  visit: "Tự dùng khi đề nghị thanh toán chỉ gồm phiếu thăm hỏi",
  payment_default: "Tự dùng cho các đề nghị thanh toán khác (không ẩn được)",
};

async function post(body: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/finance/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : (data.error ?? "Không lưu được.");
  } catch {
    return "Mất kết nối, vui lòng thử lại.";
  }
}

export function FinanceSettings({ funds, categories, lockedThrough, today }: Props) {
  const router = useRouter();
  const [fundDraft, setFundDraft] = useState<FundDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [lockDate, setLockDate] = useState(lockedThrough ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(body: unknown, done: () => void, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const err = await post(body);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    done();
    setMessage(okMessage);
    router.refresh();
  }

  const fundForm = fundDraft ? (
    <div className="space-y-3 rounded-xl border border-[#173A67]/30 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Loại quỹ</label>
          <select
            className={inputClass}
            disabled={Boolean(fundDraft.id)}
            value={fundDraft.kind}
            onChange={(e) => setFundDraft({ ...fundDraft, kind: e.target.value as FundKind })}
          >
            {(Object.keys(FUND_KIND_LABEL) as FundKind[]).map((k) => (
              <option key={k} value={k}>
                {FUND_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tên quỹ *</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.name}
            value={fundDraft.name}
            onChange={(e) => setFundDraft({ ...fundDraft, name: e.target.value })}
          />
        </div>
        {fundDraft.kind === "bank" ? (
          <>
            <div>
              <label className={labelClass}>Số tài khoản</label>
              <input
                className={inputClass}
                maxLength={FINANCE_LIMITS.account}
                value={fundDraft.bankAccountNo}
                onChange={(e) => setFundDraft({ ...fundDraft, bankAccountNo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Ngân hàng</label>
              <input
                className={inputClass}
                maxLength={FINANCE_LIMITS.name}
                value={fundDraft.bankName}
                onChange={(e) => setFundDraft({ ...fundDraft, bankName: e.target.value })}
              />
            </div>
          </>
        ) : null}
        <div>
          <label className={labelClass}>Ngày bắt đầu theo dõi *</label>
          <input
            className={inputClass}
            type="date"
            value={fundDraft.openingDate}
            onChange={(e) => setFundDraft({ ...fundDraft, openingDate: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Số dư đầu kỳ (tại ngày bắt đầu)</label>
          <input
            className={inputClass}
            inputMode="numeric"
            value={fundDraft.openingBalance ? new Intl.NumberFormat("vi-VN").format(Number(fundDraft.openingBalance)) : ""}
            onChange={(e) => setFundDraft({ ...fundDraft, openingBalance: e.target.value.replace(/\D/g, "").slice(0, 12) })}
          />
        </div>
        <div>
          <label className={labelClass}>Thứ tự hiển thị</label>
          <input
            className={inputClass}
            type="number"
            value={fundDraft.sortOrder}
            onChange={(e) => setFundDraft({ ...fundDraft, sortOrder: Number(e.target.value) || 0 })}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input
            checked={fundDraft.isActive}
            type="checkbox"
            onChange={(e) => setFundDraft({ ...fundDraft, isActive: e.target.checked })}
          />
          Đang sử dụng
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() =>
            void run(
              { action: "saveFund", fund: { ...fundDraft, openingBalance: Number(fundDraft.openingBalance || 0) } },
              () => setFundDraft(null),
              "Đã lưu quỹ.",
            )
          }
        >
          Lưu quỹ
        </button>
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant"
          type="button"
          onClick={() => setFundDraft(null)}
        >
          Đóng
        </button>
      </div>
    </div>
  ) : null;

  const categoryForm = categoryDraft ? (
    <div className="space-y-3 rounded-xl border border-[#173A67]/30 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_110px]">
        <div>
          <label className={labelClass}>Mã (nếu có)</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.categoryCode}
            value={categoryDraft.code}
            onChange={(e) => setCategoryDraft({ ...categoryDraft, code: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Tên danh mục {categoryDraft.kind === "income" ? "thu" : "chi"} *</label>
          <input
            className={inputClass}
            maxLength={FINANCE_LIMITS.categoryName}
            value={categoryDraft.name}
            onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Thứ tự</label>
          <input
            className={inputClass}
            type="number"
            value={categoryDraft.sortOrder}
            onChange={(e) => setCategoryDraft({ ...categoryDraft, sortOrder: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          checked={categoryDraft.isActive}
          disabled={categoryDraft.systemKey === "payment_default"}
          type="checkbox"
          onChange={(e) => setCategoryDraft({ ...categoryDraft, isActive: e.target.checked })}
        />
        Đang sử dụng (bỏ chọn để ẩn khỏi ô chọn khi ghi sổ; bút toán cũ vẫn giữ danh mục)
      </label>
      <div className="flex gap-2">
        <button
          className="rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => void run({ action: "saveCategory", category: categoryDraft }, () => setCategoryDraft(null), "Đã lưu danh mục.")}
        >
          Lưu danh mục
        </button>
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant"
          type="button"
          onClick={() => setCategoryDraft(null)}
        >
          Đóng
        </button>
      </div>
    </div>
  ) : null;

  const suggestedLock = endOfPreviousMonth(today);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title-md font-bold text-[#173A67]">Các quỹ</h2>
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
            type="button"
            onClick={() =>
              setFundDraft({
                kind: "bank",
                name: "",
                bankAccountNo: "",
                bankName: "",
                openingBalance: "",
                openingDate: `${today.slice(0, 4)}-01-01`,
                isActive: true,
                sortOrder: funds.length + 1,
              })
            }
          >
            <MaterialIcon className="text-[18px]" name="add" />
            Thêm quỹ / tài khoản
          </button>
        </div>
        {fundDraft && !fundDraft.id ? fundForm : null}
        <ul className="divide-y divide-outline-variant">
          {funds.map((f) => (
            <li key={f.id} className="py-2.5">
              {fundDraft?.id === f.id ? (
                fundForm
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <MaterialIcon className="text-[22px] text-[#173A67]" name={f.kind === "cash" ? "payments" : "account_balance"} />
                  <div className="min-w-[200px] flex-1">
                    <p className={`font-bold ${f.is_active ? "" : "text-on-surface-variant line-through"}`}>{f.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {f.kind === "bank" ? [f.bank_account_no && `TK ${f.bank_account_no}`, f.bank_name].filter(Boolean).join(" · ") || "Tiền gửi ngân hàng" : "Tiền mặt"}
                      {" · "}Số dư đầu kỳ {formatVnd(f.opening_balance)} tại {formatDateVi(f.opening_date)}
                    </p>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                    type="button"
                    onClick={() =>
                      setFundDraft({
                        id: f.id,
                        kind: f.kind,
                        name: f.name,
                        bankAccountNo: f.bank_account_no ?? "",
                        bankName: f.bank_name ?? "",
                        openingBalance: f.opening_balance ? String(f.opening_balance) : "",
                        openingDate: f.opening_date,
                        isActive: f.is_active,
                        sortOrder: f.sort_order,
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
        <p className="text-xs text-on-surface-variant">
          Số dư đầu kỳ là số tiền thực có tại ngày bắt đầu theo dõi trên web (theo sổ sách giấy / sao kê ngân hàng). Bút toán chỉ ghi được
          từ ngày đó trở đi. Đề nghị thanh toán chuyển khoản tự ghi vào quỹ ngân hàng đầu tiên, trả tiền mặt ghi vào quỹ tiền mặt.
        </p>
      </section>

      {(["income", "expense"] as CategoryKind[]).map((kind) => (
        <section key={kind} className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-title-md font-bold text-[#173A67]">Danh mục {kind === "income" ? "thu" : "chi"}</h2>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-1.5 text-sm font-semibold text-[#173A67] hover:border-[#173A67]"
              type="button"
              onClick={() =>
                setCategoryDraft({
                  kind,
                  code: "",
                  name: "",
                  isActive: true,
                  sortOrder: (categories.filter((c) => c.kind === kind).at(-1)?.sort_order ?? 0) + 5,
                  systemKey: null,
                })
              }
            >
              <MaterialIcon className="text-[18px]" name="add" />
              Thêm danh mục
            </button>
          </div>
          {categoryDraft && !categoryDraft.id && categoryDraft.kind === kind ? categoryForm : null}
          <ul className="divide-y divide-outline-variant">
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <li key={c.id} className="py-2">
                  {categoryDraft?.id === c.id ? (
                    categoryForm
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[200px] flex-1">
                        <p className={`text-sm font-semibold ${c.is_active ? "" : "text-on-surface-variant line-through"}`}>
                          {c.code ? <span className="mr-1 text-on-surface-variant">{c.code}</span> : null}
                          {c.name}
                        </p>
                        {c.system_key ? <p className="text-[11px] text-sky-800">{SYSTEM_HINT[c.system_key]}</p> : null}
                      </div>
                      <button
                        className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                        type="button"
                        onClick={() =>
                          setCategoryDraft({
                            id: c.id,
                            kind: c.kind,
                            code: c.code ?? "",
                            name: c.name,
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
      ))}

      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <h2 className="text-title-md font-bold text-[#173A67]">Khóa sổ</h2>
        <p className="text-sm text-on-surface-variant">
          {lockedThrough ? (
            <>
              Đang khóa sổ đến hết ngày <b>{formatDateVi(lockedThrough)}</b>. Bút toán từ ngày này trở về trước không thêm, sửa hay hủy được.
            </>
          ) : (
            "Chưa khóa sổ. Nên khóa sau khi đã đối chiếu số dư cuối tháng với tiền mặt thực tế và sao kê ngân hàng."
          )}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Khóa đến hết ngày</label>
            <input className={inputClass} type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
          </div>
          <button
            className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
            type="button"
            onClick={() => setLockDate(suggestedLock)}
          >
            Hết tháng trước ({formatDateVi(suggestedLock)})
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={busy || !lockDate || lockDate === lockedThrough}
            type="button"
            onClick={() => {
              if (lockDate > today) {
                setError("Không khóa sổ cho ngày trong tương lai.");
                return;
              }
              if (confirm(`Khóa sổ đến hết ngày ${formatDateVi(lockDate)}?`)) {
                void run({ action: "setLock", lockedThrough: lockDate }, () => undefined, "Đã cập nhật khóa sổ.");
              }
            }}
          >
            <MaterialIcon className="text-[18px]" name="lock" />
            Khóa sổ
          </button>
          {lockedThrough ? (
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-60"
              disabled={busy}
              type="button"
              onClick={() => {
                if (confirm("Mở khóa sổ hoàn toàn? Các kỳ cũ sẽ sửa được trở lại.")) {
                  void run({ action: "setLock", lockedThrough: null }, () => setLockDate(""), "Đã mở khóa sổ.");
                }
              }}
            >
              <MaterialIcon className="text-[18px]" name="lock_open" />
              Mở khóa
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
