"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  SAVINGS_STATUS_CLASS,
  calculateMonthlyInterest,
  fundBalance,
  savingsMaturityStatus,
  type Fund,
  type FundEntry,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  savingsFunds: Fund[];
  entries: FundEntry[];
  today: string;
  canManage: boolean;
  canRecord: boolean;
  onEditFund: (fund: Fund) => void;
  onMatureFund: (fund: Fund) => void;
  onViewHistory: (fund: Fund) => void;
  onAddFund: () => void;
};

export function SavingsBookList({
  savingsFunds,
  entries,
  today,
  canManage,
  canRecord,
  onEditFund,
  onMatureFund,
  onViewHistory,
  onAddFund,
}: Props) {
  const [filterType, setFilterType] = useState<"all" | "fixed" | "floating" | "due">("all");
  const [search, setSearch] = useState("");

  const fundData = useMemo(() => {
    return savingsFunds.map((fund) => {
      const balance = fundBalance(fund, entries);
      const maturityStatus = savingsMaturityStatus(fund, today);
      const isFixed = (fund.interest_rate_type ?? "fixed") === "fixed";
      const monthlyEst =
        isFixed && fund.interest_rate && balance > 0
          ? calculateMonthlyInterest(balance, fund.interest_rate)
          : null;

      return {
        fund,
        balance,
        maturityStatus,
        isFixed,
        monthlyEst,
      };
    });
  }, [savingsFunds, entries, today]);

  const filtered = useMemo(() => {
    return fundData.filter(({ fund, isFixed, maturityStatus }) => {
      if (filterType === "fixed" && !isFixed) return false;
      if (filterType === "floating" && isFixed) return false;
      if (filterType === "due" && !maturityStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = fund.name.toLowerCase().includes(q);
        const matchesAcc = fund.bank_account_no?.toLowerCase().includes(q);
        const matchesBank = fund.bank_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesAcc && !matchesBank) return false;
      }
      return true;
    });
  }, [fundData, filterType, search]);

  const totalBalance = useMemo(
    () => fundData.reduce((sum, item) => sum + item.balance, 0),
    [fundData],
  );

  const fixedCount = useMemo(
    () => fundData.filter((i) => i.isFixed).length,
    [fundData],
  );
  const floatingCount = useMemo(
    () => fundData.filter((i) => !i.isFixed).length,
    [fundData],
  );
  const dueCount = useMemo(
    () => fundData.filter((i) => Boolean(i.maturityStatus)).length,
    [fundData],
  );

  return (
    <div className="space-y-4">
      {/* Bộ lọc và tìm kiếm */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low p-1">
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "all"
                ? "bg-white text-[#173A67] shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setFilterType("all")}
          >
            Tất cả ({savingsFunds.length})
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "fixed"
                ? "bg-white text-[#173A67] shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setFilterType("fixed")}
          >
            Lãi suất cố định ({fixedCount})
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "floating"
                ? "bg-white text-amber-900 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setFilterType("floating")}
          >
            Lãi suất thả nổi ({floatingCount})
          </button>
          {dueCount > 0 && (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filterType === "due"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
              type="button"
              onClick={() => setFilterType("due")}
            >
              Đến hạn / Quá hạn ({dueCount})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <MaterialIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
              name="search"
            />
            <input
              className="h-9 w-48 sm:w-60 rounded-xl border border-outline-variant bg-white pl-8 pr-3 text-xs outline-none focus:border-[#173A67]"
              placeholder="Tìm sổ, số sổ, ngân hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {canManage && (
            <button
              className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#122e52] transition"
              type="button"
              onClick={onAddFund}
            >
              <MaterialIcon className="text-[18px]" name="add" />
              <span>Mở sổ mới</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-on-surface-variant">
          <MaterialIcon className="mx-auto mb-2 text-[32px] opacity-40" name="savings" />
          <p className="font-semibold text-sm">Không tìm thấy sổ tiết kiệm phù hợp.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ fund, balance, maturityStatus, isFixed, monthlyEst }) => (
            <div
              key={fund.id}
              className={`flex flex-col justify-between rounded-2xl border bg-surface-container-lowest p-4 shadow-xs transition hover:shadow-md ${
                maturityStatus?.tone === "overdue"
                  ? "border-rose-400 bg-rose-50/20"
                  : maturityStatus?.tone === "due"
                    ? "border-amber-400 bg-amber-50/20"
                    : "border-outline-variant/70"
              }`}
            >
              <div className="space-y-3">
                {/* Header card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isFixed
                          ? "bg-blue-100 text-blue-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      <MaterialIcon className="text-[18px]" name="savings" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[#173A67] leading-tight line-clamp-1">
                        {fund.name}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        {fund.bank_name || "Ngân hàng"}
                        {fund.bank_account_no && ` · Số: ${fund.bank_account_no}`}
                      </p>
                    </div>
                  </div>

                  {maturityStatus && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        SAVINGS_STATUS_CLASS[maturityStatus.tone]
                      }`}
                    >
                      {maturityStatus.label}
                    </span>
                  )}
                </div>

                {/* Badge loại lãi suất */}
                <div>
                  {isFixed ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                      <MaterialIcon className="text-[13px]" name="lock" />
                      Lãi suất cố định: {fund.interest_rate !== null ? `${fund.interest_rate}%/năm` : "Chưa nhập"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      <MaterialIcon className="text-[13px]" name="trending_up" />
                      Lãi suất thả nổi (Nhập cuối mỗi tháng)
                    </span>
                  )}
                </div>

                {/* Số dư và lãi suất */}
                <div className="rounded-xl bg-surface-container-low/60 p-2.5 text-xs space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-on-surface-variant text-[11px]">Số dư gốc hiện tại:</span>
                    <span className="font-extrabold text-sm text-[#173A67]">
                      {formatVnd(balance)}
                    </span>
                  </div>

                  {isFixed && monthlyEst !== null && (
                    <div className="flex justify-between items-baseline pt-0.5 border-t border-outline-variant/40">
                      <span className="text-on-surface-variant text-[11px]">Lãi cố định / tháng:</span>
                      <span className="font-bold text-emerald-800">
                        {formatVnd(monthlyEst)}
                      </span>
                    </div>
                  )}

                  {!isFixed && (
                    <div className="flex justify-between items-baseline pt-0.5 border-t border-outline-variant/40">
                      <span className="text-on-surface-variant text-[11px]">Cơ chế tính:</span>
                      <span className="text-[11px] font-semibold text-amber-800">
                        Theo % lãi từng tháng
                      </span>
                    </div>
                  )}
                </div>

                {/* Kỳ hạn và ngày đáo hạn */}
                <div className="text-[11px] text-on-surface-variant space-y-0.5">
                  {fund.term_months && (
                    <div>Kỳ hạn gửi: <b>{fund.term_months} tháng</b></div>
                  )}
                  {fund.deposit_date && (
                    <div>Ngày mở sổ: {formatDateVi(fund.deposit_date)}</div>
                  )}
                  {fund.maturity_date && (
                    <div>Ngày đáo hạn: <b>{formatDateVi(fund.maturity_date)}</b></div>
                  )}
                </div>
              </div>

              {/* Thao tác nút */}
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-outline-variant/50 mt-3">
                <button
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-[#173A67] hover:bg-surface-container transition"
                  type="button"
                  onClick={() => onViewHistory(fund)}
                >
                  <MaterialIcon className="text-[15px]" name="visibility" />
                  <span>Chi tiết & Lãi</span>
                </button>

                {canManage && (
                  <button
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67] transition"
                    title="Chỉnh sửa thông tin sổ"
                    type="button"
                    onClick={() => onEditFund(fund)}
                  >
                    <MaterialIcon className="text-[15px]" name="edit" />
                    <span>Sửa</span>
                  </button>
                )}

                {canRecord && (
                  <button
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-surface-container px-2.5 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high transition"
                    title="Tất toán chuyển tiền về tài khoản hoặc tái tục kỳ hạn mới"
                    type="button"
                    onClick={() => onMatureFund(fund)}
                  >
                    <MaterialIcon className="text-[15px]" name="event_repeat" />
                    <span>Đáo hạn</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
