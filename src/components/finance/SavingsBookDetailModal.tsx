"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  calculateMonthlyInterest,
  formatPeriodMonthVi,
  fundBalance,
  type Fund,
  type FundEntry,
  type SavingsMonthlyRate,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  fund: Fund;
  entries: FundEntry[];
  today: string;
  onClose: () => void;
  onEdit: () => void;
  onMature: () => void;
};

export function SavingsBookDetailModal({ fund, entries, today, onClose, onEdit, onMature }: Props) {
  const isFixed = (fund.interest_rate_type ?? "fixed") === "fixed";
  const balance = fundBalance(fund, entries);
  const [rates, setRates] = useState<SavingsMonthlyRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isFixed) {
      setLoading(true);
      fetch(`/api/finance/savings/rates?fundId=${fund.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.rates)) {
            setRates(data.rates);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [fund.id, isFixed]);

  const numRate = fund.interest_rate ?? 0;
  const fixedMonthly = isFixed && numRate > 0 && balance > 0 ? calculateMonthlyInterest(balance, numRate) : 0;
  const termMonths = fund.term_months ?? 0;
  const fixedTerm = termMonths > 0 ? fixedMonthly * termMonths : 0;

  // Lọc các bút toán liên quan đến sổ này trong sổ quỹ
  const fundEntries = entries
    .filter((e) => e.status === "posted" && (e.fund_id === fund.id || e.to_fund_id === fund.id))
    .slice(-10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                isFixed ? "bg-blue-100 text-blue-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              <MaterialIcon className="text-[20px]" name="savings" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#173A67]">{fund.name}</h2>
              <p className="text-xs text-on-surface-variant">
                {fund.bank_name || "Ngân hàng"} {fund.bank_account_no && `· Số: ${fund.bank_account_no}`}
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

        <div className="space-y-5 p-6">
          {/* Thông tin chung */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-surface-container-low/60 p-4 text-xs">
            <div>
              <span className="text-on-surface-variant block text-[11px]">Hình thức lãi:</span>
              <span className="font-bold text-sm text-[#173A67]">
                {isFixed ? "Lãi suất cố định" : "Lãi suất thả nổi"}
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant block text-[11px]">Số dư gốc hiện tại:</span>
              <span className="font-extrabold text-sm text-emerald-800">{formatVnd(balance)}</span>
            </div>
            <div>
              <span className="text-on-surface-variant block text-[11px]">Kỳ hạn:</span>
              <span className="font-bold text-sm text-on-surface">
                {termMonths > 0 ? `${termMonths} tháng` : "Không kỳ hạn"}
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant block text-[11px]">Ngày đáo hạn:</span>
              <span className="font-bold text-sm text-on-surface">
                {fund.maturity_date ? formatDateVi(fund.maturity_date) : "—"}
              </span>
            </div>
          </div>

          {/* Chi tiết tính lãi theo loại lãi suất */}
          {isFixed ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 text-sm">
                <MaterialIcon className="text-[18px]" name="calculate" />
                <span>Cơ chế tính lãi suất cố định ({numRate}%/năm):</span>
              </div>
              <p className="text-xs text-blue-950/80 leading-relaxed">
                Với lãi suất cố định, tiền lãi được tính ổn định cho từng tháng và cả kỳ hạn gửi theo đúng tỷ lệ thỏa thuận:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white p-3 border border-blue-100 shadow-xs">
                  <span className="text-on-surface-variant text-[11px]">Tiền lãi dự tính 1 tháng:</span>
                  <div className="text-base font-extrabold text-blue-900 mt-0.5">
                    {formatVnd(fixedMonthly)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 font-mono">
                    Công thức: {formatVnd(balance)} × {numRate}% ÷ 12
                  </div>
                </div>

                {termMonths > 0 && (
                  <div className="rounded-xl bg-white p-3 border border-blue-100 shadow-xs">
                    <span className="text-on-surface-variant text-[11px]">Tiền lãi dự tính cả kỳ ({termMonths} tháng):</span>
                    <div className="text-base font-extrabold text-blue-900 mt-0.5">
                      {formatVnd(fixedTerm)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 font-mono">
                      Công thức: {formatVnd(fixedMonthly)} × {termMonths} tháng
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                  <MaterialIcon className="text-[18px]" name="history" />
                  <span>Lịch sử lãi suất & tiền lãi các tháng (Lãi thả nổi):</span>
                </div>
                {loading && <span className="text-xs text-on-surface-variant">Đang tải...</span>}
              </div>

              {rates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-xs text-on-surface-variant">
                  Chưa có kỳ tính lãi nào được nhập cho sổ này. Vào tab &quot;Tính lãi thả nổi hàng tháng&quot; để nhập % lãi các tháng.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-outline-variant">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-outline-variant bg-surface-container-low font-bold text-on-surface-variant uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Kỳ (Tháng)</th>
                        <th className="py-2.5 px-3 text-right">Tiền gốc</th>
                        <th className="py-2.5 px-3 text-center">% Lãi suất</th>
                        <th className="py-2.5 px-3 text-right">Tiền lãi tính ra</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {rates.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3 font-bold text-[#173A67]">
                            {formatPeriodMonthVi(r.period_month)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {formatVnd(r.principal_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-900">
                            {r.interest_rate}%/năm
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                            {formatVnd(r.interest_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {r.is_collected ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Đã thu lãi
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Đã tính (Chưa thu)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Lịch sử giao dịch sổ quỹ */}
          {fundEntries.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant">
                Giao dịch gần nhất trên sổ quỹ
              </h4>
              <div className="overflow-x-auto rounded-xl border border-outline-variant">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
                    <tr>
                      <th className="py-2 px-3">Ngày</th>
                      <th className="py-2 px-3">Loại</th>
                      <th className="py-2 px-3">Diễn giải</th>
                      <th className="py-2 px-3 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {fundEntries.map((e) => {
                      const isIncoming = e.to_fund_id === fund.id || e.fund_id === fund.id && e.kind === "income";
                      return (
                        <tr key={e.id}>
                          <td className="py-2 px-3">{formatDateVi(e.entry_date)}</td>
                          <td className="py-2 px-3 font-semibold">
                            {e.kind === "transfer" ? "Chuyển quỹ" : e.kind === "income" ? "Thu lãi" : "Chi"}
                          </td>
                          <td className="py-2 px-3 max-w-[200px] truncate">{e.description}</td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              isIncoming ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {isIncoming ? "+" : "-"}
                            {formatVnd(e.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer nút hành động */}
          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/60">
            <button
              className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              type="button"
              onClick={onClose}
            >
              Đóng
            </button>

            <div className="flex gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-[#173A67] hover:border-[#173A67]"
                type="button"
                onClick={onEdit}
              >
                <MaterialIcon className="text-[16px]" name="edit" />
                Sửa thông tin
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-xl bg-[#173A67] px-4 py-2 text-xs font-bold text-white hover:bg-[#122e52]"
                type="button"
                onClick={onMature}
              >
                <MaterialIcon className="text-[16px]" name="event_repeat" />
                Tất toán / Tái tục
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
