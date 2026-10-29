"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  calculateDailyInterest,
  calculateMonthlyInterest,
  daysInPeriodMonth,
  formatPeriodMonthVi,
  fundBalance,
  getPreviousPeriodMonth,
  type Fund,
  type FundEntry,
  type SavingsMonthlyRate,
} from "@/lib/finance/registry";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  floatingFunds: Fund[];
  allFunds: Fund[];
  entries: FundEntry[];
  today: string;
  canRecord: boolean;
  onRefreshNeeded: () => void;
};

type RowState = {
  fundId: string;
  principalAmount: number;
  interestRate: string; // text input
  calcMethod: "monthly" | "daily";
  calculatedInterest: number;
  isCustomInterest: boolean;
  note: string;
  savedRecord?: SavingsMonthlyRate | null;
};

export function SavingsFloatingInterestTable({
  floatingFunds,
  allFunds,
  entries,
  today,
  canRecord,
  onRefreshNeeded,
}: Props) {
  // Mặc định là tháng trước của ngày hiện tại (theo yêu cầu cuối mỗi tháng nhập % lãi của tháng trước)
  const defaultMonth = useMemo(() => getPreviousPeriodMonth(today), [today]);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratesList, setRatesList] = useState<SavingsMonthlyRate[]>([]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [batchRate, setBatchRate] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog ghi thu tiền lãi vào sổ quỹ
  const [collectTarget, setCollectTarget] = useState<{
    rateId: string;
    fundName: string;
    interestAmount: number;
    periodMonth: string;
    ratePercent: number;
  } | null>(null);
  const [collectTargetFundId, setCollectTargetFundId] = useState("");
  const [collectEntryDate, setCollectEntryDate] = useState(today);
  const [collectDocNo, setCollectDocNo] = useState("");
  const [collecting, setCollecting] = useState(false);

  const daysCount = useMemo(() => daysInPeriodMonth(selectedMonth), [selectedMonth]);
  const spendableFunds = useMemo(() => allFunds.filter((f) => f.is_active && f.kind !== "savings"), [allFunds]);

  // Load existing saved rates for selected month
  useEffect(() => {
    let ignore = false;
    async function fetchRates() {
      setLoading(true);
      setStatusMessage(null);
      try {
        const res = await fetch(`/api/finance/savings/rates?month=${selectedMonth}`);
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.rates)) {
          setRatesList(data.rates);
        }
      } catch (err) {
        console.error("fetch rates error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchRates();
    return () => {
      ignore = true;
    };
  }, [selectedMonth]);

  // Initialize row states whenever floatingFunds or ratesList changes
  useEffect(() => {
    const nextStates: Record<string, RowState> = {};
    const rateMap = new Map(ratesList.map((r) => [r.fund_id, r]));

    for (const fund of floatingFunds) {
      const existing = rateMap.get(fund.id);
      // Số dư gốc: nếu đã lưu trong rate thì lấy, còn không thì lấy số dư của quỹ
      const balance = fundBalance(fund, entries);
      const principal = existing ? existing.principal_amount : (balance > 0 ? balance : fund.opening_balance);
      const rateStr = existing ? String(existing.interest_rate).replace(".", ",") : (fund.interest_rate ? String(fund.interest_rate).replace(".", ",") : "");
      const method: "monthly" | "daily" = existing?.days_in_month ? "daily" : "monthly";

      const numRate = Number(rateStr.replace(",", "."));
      const autoInterest =
        method === "daily"
          ? calculateDailyInterest(principal, numRate, daysCount)
          : calculateMonthlyInterest(principal, numRate);

      nextStates[fund.id] = {
        fundId: fund.id,
        principalAmount: principal,
        interestRate: rateStr,
        calcMethod: method,
        calculatedInterest: existing ? existing.interest_amount : autoInterest,
        isCustomInterest: Boolean(existing && existing.interest_amount !== autoInterest),
        note: existing?.note ?? "",
        savedRecord: existing ?? null,
      };
    }

    setRowStates(nextStates);
  }, [floatingFunds, ratesList, entries, daysCount]);

  function updateRowRate(fundId: string, newRateStr: string) {
    setRowStates((prev) => {
      const current = prev[fundId];
      if (!current) return prev;
      const cleanRate = newRateStr.replace(/[^\d.,]/g, "").slice(0, 6);
      const numRate = Number(cleanRate.replace(",", "."));
      const autoInterest =
        current.calcMethod === "daily"
          ? calculateDailyInterest(current.principalAmount, numRate, daysCount)
          : calculateMonthlyInterest(current.principalAmount, numRate);

      return {
        ...prev,
        [fundId]: {
          ...current,
          interestRate: cleanRate,
          calculatedInterest: current.isCustomInterest ? current.calculatedInterest : autoInterest,
        },
      };
    });
  }

  function toggleCalcMethod(fundId: string) {
    setRowStates((prev) => {
      const current = prev[fundId];
      if (!current) return prev;
      const newMethod = current.calcMethod === "monthly" ? "daily" : "monthly";
      const numRate = Number(current.interestRate.replace(",", "."));
      const autoInterest =
        newMethod === "daily"
          ? calculateDailyInterest(current.principalAmount, numRate, daysCount)
          : calculateMonthlyInterest(current.principalAmount, numRate);

      return {
        ...prev,
        [fundId]: {
          ...current,
          calcMethod: newMethod,
          calculatedInterest: autoInterest,
          isCustomInterest: false,
        },
      };
    });
  }

  function updateCustomInterest(fundId: string, customAmount: number) {
    setRowStates((prev) => {
      const current = prev[fundId];
      if (!current) return prev;
      return {
        ...prev,
        [fundId]: {
          ...current,
          calculatedInterest: customAmount,
          isCustomInterest: true,
        },
      };
    });
  }

  function applyBatchRate() {
    if (!batchRate.trim()) return;
    const cleanRate = batchRate.replace(/[^\d.,]/g, "").slice(0, 6);
    const numRate = Number(cleanRate.replace(",", "."));
    if (isNaN(numRate) || numRate <= 0) return;

    setRowStates((prev) => {
      const updated = { ...prev };
      for (const fundId of Object.keys(updated)) {
        const item = updated[fundId];
        // Chỉ áp dụng cho các sổ chưa ghi thu
        if (!item.savedRecord?.is_collected) {
          const autoInterest =
            item.calcMethod === "daily"
              ? calculateDailyInterest(item.principalAmount, numRate, daysCount)
              : calculateMonthlyInterest(item.principalAmount, numRate);
          updated[fundId] = {
            ...item,
            interestRate: cleanRate,
            calculatedInterest: autoInterest,
            isCustomInterest: false,
          };
        }
      }
      return updated;
    });
  }

  // Lưu toàn bộ bảng lãi suất tháng
  async function handleSaveAll() {
    setSaving(true);
    setStatusMessage(null);
    try {
      const payloadRates = Object.values(rowStates)
        .filter((r) => Number(r.interestRate.replace(",", ".")) > 0)
        .map((r) => {
          const numRate = Number(r.interestRate.replace(",", "."));
          const formula =
            r.calcMethod === "daily"
              ? `${formatVnd(r.principalAmount)} × ${numRate}% × ${daysCount}/365`
              : `${formatVnd(r.principalAmount)} × ${numRate}% ÷ 12`;
          return {
            fundId: r.fundId,
            interestRate: numRate,
            principalAmount: r.principalAmount,
            interestAmount: r.calculatedInterest,
            daysInMonth: r.calcMethod === "daily" ? daysCount : null,
            formula,
            note: r.note || null,
          };
        });

      if (payloadRates.length === 0) {
        throw new Error("Vui lòng nhập lãi suất (%/năm) cho ít nhất một sổ tiết kiệm.");
      }

      const res = await fetch("/api/finance/savings/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodMonth: selectedMonth,
          rates: payloadRates,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Không lưu được bảng lãi suất.");
      }

      setStatusMessage({
        type: "success",
        text: `Đã lưu thành công bảng lãi suất tháng ${formatPeriodMonthVi(selectedMonth)} cho ${payloadRates.length} sổ tiết kiệm.`,
      });

      // Reload rates
      const refreshRes = await fetch(`/api/finance/savings/rates?month=${selectedMonth}`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && Array.isArray(refreshData.rates)) {
        setRatesList(refreshData.rates);
      }
      onRefreshNeeded();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Mở dialog ghi thu lãi vào sổ quỹ
  function openCollectDialog(rate: SavingsMonthlyRate, fundName: string) {
    setCollectTarget({
      rateId: rate.id,
      fundName,
      interestAmount: rate.interest_amount,
      periodMonth: rate.period_month,
      ratePercent: rate.interest_rate,
    });
    setCollectTargetFundId((spendableFunds.find((f) => f.kind === "bank") ?? spendableFunds[0])?.id ?? "");
    setCollectEntryDate(today);
    setCollectDocNo("");
  }

  async function handleConfirmCollect(e: React.FormEvent) {
    e.preventDefault();
    if (!collectTarget) return;
    if (!collectTargetFundId) {
      alert("Vui lòng chọn quỹ nhận tiền lãi.");
      return;
    }

    setCollecting(true);
    try {
      const res = await fetch("/api/finance/savings/rates/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateId: collectTarget.rateId,
          targetFundId: collectTargetFundId,
          entryDate: collectEntryDate,
          documentNo: collectDocNo.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Không ghi thu được tiền lãi.");
      }

      setStatusMessage({
        type: "success",
        text: data.message || "Đã ghi phiếu thu tiền lãi vào sổ quỹ thành công.",
      });

      setCollectTarget(null);
      // Reload rates
      const refreshRes = await fetch(`/api/finance/savings/rates?month=${selectedMonth}`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && Array.isArray(refreshData.rates)) {
        setRatesList(refreshData.rates);
      }
      onRefreshNeeded();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi ghi thu tiền lãi.");
    } finally {
      setCollecting(false);
    }
  }

  // Calculate totals
  const totalPrincipal = Object.values(rowStates).reduce((sum, r) => sum + r.principalAmount, 0);
  const totalInterest = Object.values(rowStates).reduce((sum, r) => sum + r.calculatedInterest, 0);
  const collectedCount = Object.values(rowStates).filter((r) => r.savedRecord?.is_collected).length;

  return (
    <div className="space-y-4">
      {/* Thanh công cụ chọn kỳ và nhập nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
              <MaterialIcon className="text-[20px]" name="date_range" />
            </span>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Kỳ tính lãi (Tháng / Năm)
              </label>
              <input
                className="h-9 rounded-xl border border-outline-variant bg-white px-3 text-sm font-bold text-[#173A67] outline-none focus:border-[#173A67]"
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-4 sm:pt-0">
            <button
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                selectedMonth === defaultMonth
                  ? "border-[#173A67] bg-[#173A67] text-white shadow-xs"
                  : "border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
              }`}
              type="button"
              onClick={() => setSelectedMonth(defaultMonth)}
            >
              Tháng trước ({formatPeriodMonthVi(defaultMonth)})
            </button>

            <button
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                selectedMonth === today.slice(0, 7)
                  ? "border-[#173A67] bg-[#173A67] text-white shadow-xs"
                  : "border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
              }`}
              type="button"
              onClick={() => setSelectedMonth(today.slice(0, 7))}
            >
              Tháng này ({formatPeriodMonthVi(today.slice(0, 7))})
            </button>
          </div>
        </div>

        {/* Nhập % lãi suất chung */}
        {canRecord && floatingFunds.length > 1 && (
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low/50 p-1.5">
            <input
              className="h-8 w-24 rounded-lg border border-outline-variant bg-white px-2.5 text-xs font-semibold outline-none focus:border-[#173A67]"
              placeholder="% chung"
              value={batchRate}
              onChange={(e) => setBatchRate(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <button
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] border border-outline-variant hover:bg-surface-container"
              type="button"
              onClick={applyBatchRate}
            >
              Áp dụng tất cả
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm font-semibold ${
            statusMessage.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-error/30 bg-error-container/40 text-on-error-container"
          }`}
        >
          <MaterialIcon
            className="text-[20px]"
            name={statusMessage.type === "success" ? "check_circle" : "error"}
          />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Thông tin giải thích */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950 flex items-start gap-2.5">
        <MaterialIcon className="text-[20px] text-blue-700 shrink-0 mt-0.5" name="info" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900">
            Quy trình tính lãi thả nổi kỳ {formatPeriodMonthVi(selectedMonth)} (tháng có {daysCount} ngày):
          </p>
          <p className="text-blue-900/80 leading-relaxed">
            Kế toán nhập tỷ lệ <b>% Lãi suất áp dụng</b> mà ngân hàng công bố cho tháng trước vào ô bên dưới. Hệ thống sẽ tự động tính số tiền lãi của từng sổ theo công thức chuẩn: <code>Tiền gốc × Lãi suất (%/năm) ÷ 12</code> (hoặc bấm biểu tượng chuyển đổi để tính theo số ngày thực tế <code>÷ 365</code>). Sau khi lưu, có thể bấm <b>&quot;Ghi thu lãi&quot;</b> để tự động tạo phiếu thu tiền lãi vào sổ quỹ.
          </p>
        </div>
      </div>

      {floatingFunds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
          <MaterialIcon className="mx-auto mb-2 text-[36px] text-on-surface-variant/50" name="savings" />
          <h3 className="font-bold text-on-surface">Chưa có sổ tiết kiệm lãi suất thả nổi nào</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Hiện tại các sổ tiết kiệm đang áp dụng lãi suất cố định. Khi thêm hoặc chỉnh sửa sổ, chọn hình thức &quot;Lãi suất thả nổi&quot; để quản lý lãi từng tháng tại đây.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-12 text-center">STT</th>
                  <th className="py-3 px-3 min-w-[200px]">Sổ tiết kiệm / Ngân hàng</th>
                  <th className="py-3 px-3 text-right min-w-[130px]">Tiền gốc tính lãi</th>
                  <th className="py-3 px-3 text-center min-w-[140px]">% Lãi suất tháng</th>
                  <th className="py-3 px-3 text-center w-24">Cách tính</th>
                  <th className="py-3 px-3 text-right min-w-[140px]">Tiền lãi tháng này</th>
                  <th className="py-3 px-3 text-center min-w-[120px]">Trạng thái</th>
                  <th className="py-3 pl-2 pr-4 text-center min-w-[120px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {floatingFunds.map((fund, index) => {
                  const state = rowStates[fund.id] ?? {
                    fundId: fund.id,
                    principalAmount: fund.opening_balance,
                    interestRate: "",
                    calcMethod: "monthly",
                    calculatedInterest: 0,
                    isCustomInterest: false,
                    note: "",
                  };

                  const isCollected = Boolean(state.savedRecord?.is_collected);
                  const isSaved = Boolean(state.savedRecord);

                  return (
                    <tr
                      key={fund.id}
                      className={`hover:bg-surface-container-low/40 transition ${
                        isCollected ? "bg-emerald-50/20" : ""
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center text-xs text-on-surface-variant font-medium">
                        {index + 1}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#173A67]">{fund.name}</div>
                        <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                          {fund.bank_account_no && (
                            <span className="font-mono font-medium">Số: {fund.bank_account_no}</span>
                          )}
                          {fund.bank_name && <span>· {fund.bank_name}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-medium text-on-surface">
                        {formatVnd(state.principalAmount)}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            className={`h-9 w-24 rounded-xl border px-2.5 text-center text-sm font-bold outline-none transition ${
                              isCollected
                                ? "bg-surface-container-high/60 border-outline-variant text-on-surface cursor-not-allowed"
                                : "border-outline-variant bg-white text-[#173A67] focus:border-[#173A67] focus:ring-1 focus:ring-[#173A67]"
                            }`}
                            disabled={isCollected || !canRecord}
                            placeholder="0,0"
                            value={state.interestRate}
                            onChange={(e) => updateRowRate(fund.id, e.target.value)}
                          />
                          <span className="text-xs font-semibold text-on-surface-variant">%</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <button
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                            state.calcMethod === "daily"
                              ? "bg-purple-100 text-purple-900 border border-purple-200"
                              : "bg-surface-container text-on-surface-variant border border-outline-variant/60"
                          }`}
                          disabled={isCollected || !canRecord}
                          title={
                            state.calcMethod === "daily"
                              ? `Tính theo ${daysCount} ngày thực tế trong tháng (÷ 365)`
                              : "Tính theo tháng (÷ 12)"
                          }
                          type="button"
                          onClick={() => toggleCalcMethod(fund.id)}
                        >
                          <MaterialIcon className="text-[14px]" name="swap_horiz" />
                          <span>{state.calcMethod === "daily" ? "Theo ngày" : "/12 tháng"}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-emerald-800 text-base">
                          {formatVnd(state.calculatedInterest)}
                        </div>
                        {state.isCustomInterest && (
                          <span className="text-[10px] text-amber-700 italic">Điều chỉnh tay</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {isCollected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <MaterialIcon className="text-[14px]" name="check_circle" />
                            Đã thu lãi
                          </span>
                        ) : isSaved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            <MaterialIcon className="text-[14px]" name="save" />
                            Đã lưu tính lãi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                            Chưa nhập
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 pl-2 pr-4 text-center">
                        {isCollected ? (
                          <span className="text-xs text-on-surface-variant font-medium">Hoàn tất</span>
                        ) : state.savedRecord && canRecord ? (
                          <button
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                            type="button"
                            onClick={() => openCollectDialog(state.savedRecord!, fund.name)}
                          >
                            <MaterialIcon className="text-[16px]" name="south_west" />
                            Ghi thu lãi
                          </button>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
                            title="Điều chỉnh số tiền lẻ nếu ngân hàng chi trả chênh lệch vài đồng"
                            type="button"
                            onClick={() => {
                              const promptVal = prompt(
                                `Nhập số tiền lãi chính xác cho ${fund.name} (VNĐ):`,
                                String(state.calculatedInterest),
                              );
                              if (promptVal !== null) {
                                const val = Number(promptVal.replace(/\D/g, ""));
                                if (!isNaN(val) && val >= 0) {
                                  updateCustomInterest(fund.id, val);
                                }
                              }
                            }}
                          >
                            <MaterialIcon className="text-[14px]" name="edit" />
                            Chỉnh tiền
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Hàng tổng cộng */}
              <tfoot className="border-t-2 border-outline-variant/80 bg-surface-container-low font-bold">
                <tr>
                  <td colSpan={2} className="py-3.5 pl-4 pr-3 text-sm text-[#173A67]">
                    Tổng cộng ({floatingFunds.length} sổ tiết kiệm thả nổi)
                  </td>
                  <td className="py-3.5 px-3 text-right text-sm text-[#173A67]">
                    {formatVnd(totalPrincipal)}
                  </td>
                  <td colSpan={2} />
                  <td className="py-3.5 px-3 text-right text-base text-emerald-800 font-extrabold">
                    {formatVnd(totalInterest)}
                  </td>
                  <td className="py-3.5 px-3 text-center text-xs text-on-surface-variant font-semibold">
                    Đã thu: {collectedCount}/{floatingFunds.length}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Thanh nút hành động bên dưới bảng */}
          {canRecord && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 bg-surface-container-low/40 p-4">
              <p className="text-xs text-on-surface-variant">
                Lưu ý: Bấm <b>&quot;Lưu bảng lãi suất&quot;</b> để hệ thống cập nhật tỷ lệ lãi suất và số tiền tính được. Sau đó có thể ghi thu từng sổ.
              </p>

              <div className="flex gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#122e52] disabled:opacity-50 transition"
                  disabled={saving || loading}
                  type="button"
                  onClick={handleSaveAll}
                >
                  <MaterialIcon className="text-[18px]" name="save" />
                  {saving ? "Đang lưu..." : `Lưu bảng lãi suất tháng ${formatPeriodMonthVi(selectedMonth)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal ghi thu lãi vào sổ quỹ */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <MaterialIcon className="text-[22px]" name="south_west" />
                <h3 className="font-bold text-base">Ghi thu tiền lãi vào sổ quỹ</h3>
              </div>
              <button
                className="text-on-surface-variant hover:text-on-surface"
                type="button"
                onClick={() => setCollectTarget(null)}
              >
                <MaterialIcon className="text-[20px]" name="close" />
              </button>
            </div>

            <form className="space-y-3.5" onSubmit={handleConfirmCollect}>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1">
                <p className="font-bold text-emerald-900">{collectTarget.fundName}</p>
                <p className="text-emerald-800">
                  Kỳ tính lãi: <b>{formatPeriodMonthVi(collectTarget.periodMonth)}</b> ({collectTarget.ratePercent}%/năm)
                </p>
                <p className="text-sm font-extrabold text-emerald-700 pt-1">
                  Số tiền thu: {formatVnd(collectTarget.interestAmount)}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Quỹ nhận tiền lãi *
                </label>
                <select
                  className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#173A67]"
                  value={collectTargetFundId}
                  onChange={(e) => setCollectTargetFundId(e.target.value)}
                >
                  {spendableFunds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.kind === "cash" ? "Tiền mặt" : "Tài khoản thanh toán"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Ngày ghi sổ (ngày nhận tiền) *
                </label>
                <input
                  className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]"
                  type="date"
                  value={collectEntryDate}
                  onChange={(e) => setCollectEntryDate(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Số chứng từ / Số sao kê (tùy chọn)
                </label>
                <input
                  className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]"
                  placeholder="VD: SK-10/2026"
                  value={collectDocNo}
                  onChange={(e) => setCollectDocNo(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/60">
                <button
                  className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                  disabled={collecting}
                  type="button"
                  onClick={() => setCollectTarget(null)}
                >
                  Hủy
                </button>
                <button
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
                  disabled={collecting}
                  type="submit"
                >
                  {collecting ? "Đang ghi thu..." : "Xác nhận tạo phiếu thu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
