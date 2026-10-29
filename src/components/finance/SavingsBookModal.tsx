"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  FINANCE_LIMITS,
  calculateMonthlyInterest,
  type Fund,
  type InterestPeriod,
  type InterestRateType,
} from "@/lib/finance/registry";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  fund?: Fund | null; // null nếu là tạo mới
  spendableFunds: Fund[];
  today: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67] transition";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";

function addMonthsToDate(isoDate: string, months: number): string {
  if (!isoDate || !months) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, d));
  return target.toISOString().slice(0, 10);
}

export function SavingsBookModal({ fund, spendableFunds, today, onClose, onSuccess }: Props) {
  const isEditing = Boolean(fund?.id);

  const [name, setName] = useState(fund?.name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(fund?.bank_account_no ?? "");
  const [bankName, setBankName] = useState(fund?.bank_name ?? "Agribank");
  const [interestRateType, setInterestRateType] = useState<InterestRateType>(
    fund?.interest_rate_type ?? "fixed",
  );
  const [interestRate, setInterestRate] = useState(
    fund?.interest_rate !== null && fund?.interest_rate !== undefined
      ? String(fund.interest_rate).replace(".", ",")
      : "",
  );
  const [openingBalance, setOpeningBalance] = useState(
    fund?.opening_balance ? String(fund.opening_balance) : "",
  );
  const [openingDate, setOpeningDate] = useState(
    fund?.opening_date ?? fund?.deposit_date ?? today,
  );
  const [termMonths, setTermMonths] = useState<string>(
    fund?.term_months ? String(fund.term_months) : "6",
  );
  const [maturityDate, setMaturityDate] = useState(fund?.maturity_date ?? "");
  const [interestPeriod, setInterestPeriod] = useState<InterestPeriod>(
    fund?.interest_period ?? "monthly",
  );
  const [sourceFundId, setSourceFundId] = useState<string>("");
  const [notes, setNotes] = useState(fund?.notes ?? "");
  const [isActive, setIsActive] = useState(fund ? fund.is_active : true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tự động tính ngày đáo hạn khi thay đổi ngày gửi hoặc kỳ hạn
  useEffect(() => {
    if (openingDate && termMonths && !isEditing) {
      const months = Number(termMonths);
      if (months > 0) {
        setMaturityDate(addMonthsToDate(openingDate, months));
      }
    }
  }, [openingDate, termMonths, isEditing]);

  const numPrincipal = Math.round(Number(openingBalance.replace(/\D/g, "") || 0));
  const numRate = Number(interestRate.replace(",", "."));
  const monthlyEstimatedInterest =
    numPrincipal > 0 && numRate > 0 ? calculateMonthlyInterest(numPrincipal, numRate) : 0;
  const termMonthsNum = Number(termMonths) || 0;
  const termEstimatedInterest =
    termMonthsNum > 0 ? Math.round((monthlyEstimatedInterest * termMonthsNum)) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Vui lòng nhập tên sổ tiết kiệm.");
      return;
    }

    if (interestRateType === "fixed" && (!interestRate || numRate <= 0)) {
      setError("Vui lòng nhập lãi suất cố định (%/năm).");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        id: fund?.id,
        name: name.trim(),
        bankAccountNo: bankAccountNo.trim() || null,
        bankName: bankName.trim() || null,
        interestRateType,
        interestRate: interestRateType === "fixed" ? numRate : numRate > 0 ? numRate : null,
        termMonths: termMonthsNum > 0 ? termMonthsNum : null,
        maturityDate: maturityDate || null,
        interestPeriod,
        depositDate: openingDate,
        openingBalance: numPrincipal,
        openingDate,
        sourceFundId: !isEditing && sourceFundId ? sourceFundId : null,
        notes: notes.trim() || null,
        isActive,
      };

      const res = await fetch("/api/finance/savings/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Không lưu được sổ tiết kiệm.");
      }

      onSuccess(isEditing ? "Đã cập nhật sổ tiết kiệm thành công." : "Đã tạo sổ tiết kiệm mới thành công.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <MaterialIcon className="text-[20px]" name="savings" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#173A67]">
                {isEditing ? "Chỉnh sửa sổ tiết kiệm" : "Mở sổ tiết kiệm mới"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Quản lý thông tin tiền gửi tiết kiệm, lãi suất cố định và thả nổi
              </p>
            </div>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-error/30 bg-error-container/40 p-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          {/* Chọn loại lãi suất - YÊU CẦU TRỌNG TÂM */}
          <div className="rounded-2xl border-2 border-[#173A67]/20 bg-[#173A67]/5 p-4">
            <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#173A67]">
              Hình thức lãi suất áp dụng *
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition ${
                  interestRateType === "fixed"
                    ? "border-[#173A67] bg-white shadow-sm"
                    : "border-outline-variant/60 bg-white/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    checked={interestRateType === "fixed"}
                    className="text-[#173A67] focus:ring-[#173A67]"
                    name="interestRateType"
                    type="radio"
                    value="fixed"
                    onChange={() => setInterestRateType("fixed")}
                  />
                  <span className="text-sm font-bold text-[#173A67]">Lãi suất cố định</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-on-surface-variant">
                  Lãi suất giữ nguyên suốt kỳ hạn. Tiền lãi tính trực tiếp theo % lãi suất quy định.
                </p>
              </label>

              <label
                className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition ${
                  interestRateType === "floating"
                    ? "border-amber-600 bg-white shadow-sm"
                    : "border-outline-variant/60 bg-white/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    checked={interestRateType === "floating"}
                    className="text-amber-600 focus:ring-amber-600"
                    name="interestRateType"
                    type="radio"
                    value="floating"
                    onChange={() => setInterestRateType("floating")}
                  />
                  <span className="text-sm font-bold text-amber-800">Lãi suất thả nổi</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-on-surface-variant">
                  Lãi suất thay đổi theo tháng. Cuối mỗi tháng kế toán nhập % lãi tháng trước để tự tính tiền lãi.
                </p>
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tên sổ tiết kiệm *</label>
              <input
                className={inputClass}
                maxLength={FINANCE_LIMITS.name}
                placeholder="VD: Sổ tiết kiệm Vietcombank 6 tháng"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Ngân hàng mở sổ *</label>
              <input
                className={inputClass}
                maxLength={FINANCE_LIMITS.name}
                placeholder="VD: Vietcombank, Agribank, BIDV..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Số sổ / Hợp đồng tiền gửi</label>
              <input
                className={inputClass}
                maxLength={FINANCE_LIMITS.account}
                placeholder="VD: 001023931792"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Số tiền gửi gốc (VNĐ) *</label>
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="VD: 100.000.000"
                value={numPrincipal ? new Intl.NumberFormat("vi-VN").format(numPrincipal) : ""}
                onChange={(e) => setOpeningBalance(e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
            </div>

            <div>
              <label className={labelClass}>Ngày gửi / Ngày mở sổ *</label>
              <input
                className={inputClass}
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Kỳ hạn gửi (tháng)</label>
              <select
                className={inputClass}
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
              >
                <option value="1">1 tháng</option>
                <option value="2">2 tháng</option>
                <option value="3">3 tháng</option>
                <option value="6">6 tháng</option>
                <option value="9">9 tháng</option>
                <option value="12">12 tháng (1 năm)</option>
                <option value="18">18 tháng</option>
                <option value="24">24 tháng (2 năm)</option>
                <option value="36">36 tháng (3 năm)</option>
                <option value="0">Không kỳ hạn / Khác</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Ngày đáo hạn</label>
              <input
                className={inputClass}
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>
                {interestRateType === "fixed" ? "Lãi suất cố định (%/năm) *" : "Lãi suất tham chiếu (%/năm)"}
              </label>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder={interestRateType === "fixed" ? "VD: 4,5" : "Tùy chọn lãi suất ban đầu"}
                value={interestRate}
                onChange={(e) =>
                  setInterestRate(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))
                }
              />
            </div>
          </div>

          {/* Khung tính tiền lãi mẫu đối với Lãi suất cố định */}
          {interestRateType === "fixed" && numPrincipal > 0 && numRate > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <MaterialIcon className="text-[18px]" name="calculate" />
                <span>Tiền lãi dự tính (Lãi suất cố định {numRate}%/năm):</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white p-2 border border-emerald-100">
                  <p className="text-muted-foreground text-[11px]">Tiền lãi 1 tháng:</p>
                  <p className="text-sm font-bold text-emerald-700">{formatVnd(monthlyEstimatedInterest)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {formatVnd(numPrincipal)} × {numRate}% ÷ 12
                  </p>
                </div>
                {termMonthsNum > 0 && (
                  <div className="rounded-lg bg-white p-2 border border-emerald-100">
                    <p className="text-muted-foreground text-[11px]">Tiền lãi cả kỳ ({termMonthsNum} tháng):</p>
                    <p className="text-sm font-bold text-emerald-700">{formatVnd(termEstimatedInterest)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {formatVnd(monthlyEstimatedInterest)} × {termMonthsNum} tháng
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hướng dẫn với Lãi suất thả nổi */}
          {interestRateType === "floating" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <MaterialIcon className="text-[18px]" name="trending_up" />
                <span>Cơ chế quản lý lãi suất thả nổi:</span>
              </div>
              <p className="mt-1 text-amber-900/90 leading-relaxed">
                Khi lưu sổ này, hệ thống sẽ đưa vào danh sách theo dõi lãi suất thả nổi. Vào cuối mỗi tháng (hoặc đầu tháng kế tiếp), kế toán vào tab <b>&quot;Tính lãi thả nổi hàng tháng&quot;</b> để nhập % lãi suất mà ngân hàng áp dụng cho tháng trước. Hệ thống sẽ tự động tính chính xác số tiền lãi từng tháng và hỗ trợ ghi thu vào sổ quỹ.
              </p>
            </div>
          )}

          {/* Trích nguồn tiền khi tạo sổ mới */}
          {!isEditing && (
            <div>
              <label className={labelClass}>Nguồn tiền gửi vào sổ</label>
              <select
                className={inputClass}
                value={sourceFundId}
                onChange={(e) => setSourceFundId(e.target.value)}
              >
                <option value="">-- Không tạo phiếu chuyển quỹ (Khai báo số dư sổ có sẵn) --</option>
                {spendableFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    Trích từ quỹ: {f.name} ({f.kind === "cash" ? "Tiền mặt" : "Tài khoản thanh toán"})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Nếu chọn trích từ quỹ thanh toán/tiền mặt, hệ thống sẽ tự động ghi bút toán Chuyển quỹ sang sổ này.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Ghi chú thêm</label>
            <textarea
              className={inputClass}
              placeholder="VD: Điều kiện rút trước hạn, thỏa thuận lãi suất, số liên lạc ngân hàng..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <input
                checked={isActive}
                type="checkbox"
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Đang hoạt động (sổ chưa tất toán)
            </label>

            <div className="flex gap-2">
              <button
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                disabled={busy}
                type="button"
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#122e52] disabled:opacity-50"
                disabled={busy}
                type="submit"
              >
                <MaterialIcon className="text-[18px]" name="check" />
                {busy ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Lưu sổ tiết kiệm"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
