"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  FINANCE_LIMITS,
  fundBalance,
  isSpendableFund,
  type Fund,
  type FundEntry,
  type SavingsMaturityAction,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

const inputClass =
  "block h-9 w-full rounded-lg border border-outline-variant bg-white px-2.5 text-sm text-on-surface outline-none focus:border-[#173A67]";
const labelClass = "mb-0.5 block text-[11px] font-semibold text-on-surface-variant";

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Tất toán / Tái tục sổ tiết kiệm: ghi sẵn phiếu thu lãi (danh mục Lãi tiền gửi ngân hàng) và phiếu chuyển quỹ,
 * cập nhật sổ (ngừng dùng hoặc ngày đáo hạn / lãi suất mới) trong một lần bấm.
 */
export function SavingsMaturityDialog({
  fund,
  funds,
  entries,
  today,
  onClose,
  onDone,
}: {
  fund: Fund;
  funds: Fund[];
  entries: FundEntry[];
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const spendable = funds.filter((f) => f.is_active && isSpendableFund(f));
  const defaultTarget = (spendable.find((f) => f.kind === "bank") ?? spendable[0])?.id ?? "";
  const [action, setAction] = useState<SavingsMaturityAction>("renew");
  const [entryDate, setEntryDate] = useState(fund.maturity_date && fund.maturity_date <= today ? fund.maturity_date : today);
  const [interest, setInterest] = useState("");
  const [targetFundId, setTargetFundId] = useState(defaultTarget);
  const [interestToSavings, setInterestToSavings] = useState(true);
  const [newMaturityDate, setNewMaturityDate] = useState("");
  const [newRate, setNewRate] = useState(fund.interest_rate === null ? "" : String(fund.interest_rate).replace(".", ","));
  const [documentNo, setDocumentNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interestAmount = Number(interest || 0);
  const balance = fundBalance(fund, entries, entryDate);
  const targetName = spendable.find((f) => f.id === targetFundId)?.name ?? "";
  const termBase = fund.maturity_date ?? entryDate;

  const steps: string[] = [];
  if (interestAmount > 0) {
    const into = action === "renew" && !interestToSavings ? targetName : fund.name;
    steps.push(`Phiếu thu ${formatVnd(interestAmount)} – Lãi tiền gửi ngân hàng, vào ${into || "…"}.`);
  }
  if (action === "settle") {
    steps.push(`Chuyển quỹ ${formatVnd(balance + interestAmount)} (gốc và lãi) từ ${fund.name} về ${targetName || "…"}.`);
    steps.push("Sổ chuyển sang ngừng sử dụng.");
  } else {
    steps.push(
      `Sổ gửi tiếp: đáo hạn mới ${newMaturityDate ? formatDateVi(newMaturityDate) : "…"}${newRate ? `, lãi suất ${newRate}%/năm` : ""}.`,
    );
  }

  async function submit() {
    setError(null);
    if (action === "settle" && !targetFundId) return setError("Vui lòng chọn quỹ nhận tiền tất toán.");
    if (action === "renew" && !newMaturityDate) return setError("Vui lòng nhập ngày đáo hạn mới.");
    if (action === "renew" && !interestToSavings && interestAmount > 0 && !targetFundId) {
      return setError("Vui lòng chọn quỹ nhận tiền lãi.");
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/savings/${fund.id}/mature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          entryDate,
          interestAmount,
          targetFundId: action === "settle" || !interestToSavings ? targetFundId : null,
          newMaturityDate: action === "renew" ? newMaturityDate : null,
          newInterestRate: action === "renew" ? newRate : null,
          documentNo,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; codes?: string[] };
      if (!res.ok) throw new Error(data.error || "Không xử lý được sổ tiết kiệm.");
      const codes = data.codes?.length ? ` Đã ghi ${data.codes.join(", ")}.` : "";
      onDone(
        action === "settle"
          ? `Đã tất toán sổ “${fund.name}”.${codes}`
          : `Đã tái tục sổ “${fund.name}”, đáo hạn mới ${formatDateVi(newMaturityDate)}.${codes}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được sổ tiết kiệm.");
      setBusy(false);
    }
  }

  return (
    <div
      aria-labelledby="savings-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-bg shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-amber-700" name="savings" />
          <h2 className="min-w-0 flex-1 text-sm font-extrabold text-[#173A67]" id="savings-dialog-title">
            Tất toán / Tái tục sổ tiết kiệm
          </h2>
          <button
            aria-label="Đóng"
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40"
            disabled={busy}
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto px-4 py-3">
          <p className="text-xs text-on-surface-variant">
            <strong className="text-[#173A67]">{fund.name}</strong>
            {fund.bank_name ? ` – ${fund.bank_name}` : ""}
            {fund.maturity_date ? ` · đáo hạn ${formatDateVi(fund.maturity_date)}` : ""}
            {` · số dư ${formatVnd(fundBalance(fund, entries))}`}
          </p>

          <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
            {(
              [
                { key: "renew", icon: "autorenew", title: "Tái tục", sub: "Gửi tiếp kỳ mới" },
                { key: "settle", icon: "account_balance", title: "Tất toán", sub: "Rút gốc + lãi về tài khoản" },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                aria-checked={action === o.key}
                className={`rounded-lg border px-2.5 py-2 text-left ${
                  action === o.key ? "border-[#173A67] bg-[#173A67]/5" : "border-outline-variant bg-white hover:border-[#173A67]/50"
                }`}
                disabled={busy}
                role="radio"
                type="button"
                onClick={() => setAction(o.key)}
              >
                <span className="flex items-center gap-1 text-sm font-bold text-[#173A67]">
                  <MaterialIcon className="text-[18px]" name={o.icon} />
                  {o.title}
                </span>
                <span className="block text-[11px] text-on-surface-variant">{o.sub}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelClass}>Ngày ghi sổ *</span>
              <input className={inputClass} disabled={busy} type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Tiền lãi nhận được</span>
              <input
                className={inputClass}
                disabled={busy}
                inputMode="numeric"
                placeholder="0"
                value={interest ? new Intl.NumberFormat("vi-VN").format(Number(interest)) : ""}
                onChange={(e) => setInterest(e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
            </label>
          </div>
          <p className="-mt-1 text-[11px] text-on-surface-variant">
            Theo giấy báo có / sổ của ngân hàng. Để trống nếu lãi đã ghi trước đó.
          </p>

          {action === "renew" ? (
            <>
              <div>
                <span className={labelClass}>Tiền lãi</span>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input checked={interestToSavings} disabled={busy} type="radio" onChange={() => setInterestToSavings(true)} />
                    Nhập gốc vào sổ tiết kiệm
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input checked={!interestToSavings} disabled={busy} type="radio" onChange={() => setInterestToSavings(false)} />
                    Trả về tài khoản / tiền mặt
                  </label>
                </div>
              </div>
              {!interestToSavings ? (
                <label className="block">
                  <span className={labelClass}>Quỹ nhận tiền lãi</span>
                  <select className={inputClass} disabled={busy} value={targetFundId} onChange={(e) => setTargetFundId(e.target.value)}>
                    {spendable.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={labelClass}>Ngày đáo hạn mới *</span>
                  <input
                    className={inputClass}
                    disabled={busy}
                    min={entryDate}
                    type="date"
                    value={newMaturityDate}
                    onChange={(e) => setNewMaturityDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Lãi suất mới (%/năm)</span>
                  <input
                    className={inputClass}
                    disabled={busy}
                    inputMode="decimal"
                    placeholder="Giữ như cũ"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
                  />
                </label>
              </div>
              <div className="-mt-1 flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
                Kỳ hạn tính từ {formatDateVi(termBase)}:
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    className="rounded-full border border-outline-variant bg-white px-2 py-0.5 font-semibold text-[#173A67] hover:border-[#173A67]"
                    disabled={busy}
                    type="button"
                    onClick={() => setNewMaturityDate(addMonths(termBase, m))}
                  >
                    {m} tháng
                  </button>
                ))}
              </div>
            </>
          ) : (
            <label className="block">
              <span className={labelClass}>Quỹ nhận tiền tất toán *</span>
              <select className={inputClass} disabled={busy} value={targetFundId} onChange={(e) => setTargetFundId(e.target.value)}>
                {spendable.length === 0 ? <option value="">Chưa có tài khoản thanh toán / tiền mặt đang dùng</option> : null}
                {spendable.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className={labelClass}>Số chứng từ (giấy báo có, nếu có)</span>
            <input
              className={inputClass}
              disabled={busy}
              maxLength={FINANCE_LIMITS.documentNo}
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
            />
          </label>

          <div className="rounded-lg border border-[#d2dfe9] bg-[#f4f8fc] px-2.5 py-2 text-[11px] text-[#173A67]">
            <p className="mb-0.5 font-bold">Hệ thống sẽ ghi:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>

          {error ? (
            <p className="rounded-lg border border-error/30 bg-error-container/40 px-2.5 py-1.5 text-xs font-semibold text-on-error-container">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant bg-white px-4 py-2.5">
          <button
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() => void submit()}
          >
            <MaterialIcon className="text-[16px]" name={busy ? "progress_activity" : action === "settle" ? "account_balance" : "autorenew"} />
            {busy ? "Đang ghi…" : action === "settle" ? "Tất toán" : "Tái tục"}
          </button>
        </div>
      </div>
    </div>
  );
}
