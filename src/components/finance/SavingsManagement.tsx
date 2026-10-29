"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SavingsBookDetailModal } from "@/components/finance/SavingsBookDetailModal";
import { SavingsBookList } from "@/components/finance/SavingsBookList";
import { SavingsBookModal } from "@/components/finance/SavingsBookModal";
import { SavingsFloatingInterestTable } from "@/components/finance/SavingsFloatingInterestTable";
import { SavingsMaturityDialog } from "@/components/finance/SavingsMaturityDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  calculateMonthlyInterest,
  fundBalance,
  getPreviousPeriodMonth,
  savingsMaturityStatus,
  type Fund,
  type FundEntry,
  type SavingsMonthlyRate,
} from "@/lib/finance/registry";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  funds: Fund[];
  entries: FundEntry[];
  initialMonthlyRates: SavingsMonthlyRate[];
  today: string;
  canManage: boolean;
  canRecord: boolean;
};

export function SavingsManagement({
  funds,
  entries,
  initialMonthlyRates,
  today,
  canManage,
  canRecord,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"list" | "floating" | "guide">("list");
  const [modalState, setModalState] = useState<{
    type: "create" | "edit" | "detail" | "mature" | null;
    fund: Fund | null;
  }>({ type: null, fund: null });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const savingsFunds = useMemo(
    () => funds.filter((f) => f.kind === "savings"),
    [funds],
  );

  const floatingFunds = useMemo(
    () =>
      savingsFunds.filter(
        (f) => f.is_active && f.interest_rate_type === "floating",
      ),
    [savingsFunds],
  );

  const fixedFunds = useMemo(
    () =>
      savingsFunds.filter(
        (f) => f.is_active && (f.interest_rate_type ?? "fixed") === "fixed",
      ),
    [savingsFunds],
  );

  const spendableFunds = useMemo(
    () => funds.filter((f) => f.is_active && f.kind !== "savings"),
    [funds],
  );

  // Tính các chỉ số KPI
  const totalSavingsBalance = useMemo(
    () => savingsFunds.reduce((sum, f) => sum + fundBalance(f, entries), 0),
    [savingsFunds, entries],
  );

  const fixedMonthlyInterest = useMemo(
    () =>
      fixedFunds.reduce((sum, f) => {
        const bal = fundBalance(f, entries);
        return sum + (f.interest_rate && bal > 0 ? calculateMonthlyInterest(bal, f.interest_rate) : 0);
      }, 0),
    [fixedFunds, entries],
  );

  const previousMonth = useMemo(() => getPreviousPeriodMonth(today), [today]);
  const floatingMonthRates = useMemo(
    () => initialMonthlyRates.filter((r) => r.period_month === previousMonth),
    [initialMonthlyRates, previousMonth],
  );
  const floatingCountUnentered = useMemo(
    () => floatingFunds.filter((f) => !floatingMonthRates.some((r) => r.fund_id === f.id)).length,
    [floatingFunds, floatingMonthRates],
  );

  const dueSavingsCount = useMemo(
    () =>
      savingsFunds.filter((f) => {
        const s = savingsMaturityStatus(f, today);
        return s !== null && fundBalance(f, entries) > 0;
      }).length,
    [savingsFunds, entries, today],
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    router.refresh();
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#173A67] px-5 py-3 text-sm font-semibold text-white shadow-xl animate-in slide-in-from-top-2">
          <MaterialIcon className="text-[20px] text-emerald-400" name="check_circle" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <Link prefetch={false} className="hover:text-[#173A67]" href="/admin/finance">
              Tài chính công đoàn
            </Link>
            <MaterialIcon className="text-[14px]" name="chevron_right" />
            <Link prefetch={false} className="hover:text-[#173A67]" href="/admin/finance/ledger">
              Sổ quỹ
            </Link>
            <MaterialIcon className="text-[14px]" name="chevron_right" />
            <span className="text-[#173A67] font-bold">Quản lý sổ tiết kiệm</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#173A67]">
            Quản lý sổ tiết kiệm
          </h1>
          <p className="text-sm text-on-surface-variant max-w-3xl">
            Theo dõi tiền gửi tiết kiệm công đoàn, lãi suất cố định và lãi suất thả nổi. Hàng tháng nhập % lãi suất thả nổi của tháng trước để tự động tính tiền lãi từng sổ và ghi thu vào sổ quỹ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            prefetch={false}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3.5 py-2 text-xs font-bold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67] transition"
            href="/admin/finance/ledger"
          >
            <MaterialIcon className="text-[18px]" name="account_balance_wallet" />
            <span>Mở sổ quỹ</span>
          </Link>

          {canManage && (
            <button
              className="flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#122e52] transition"
              type="button"
              onClick={() => setModalState({ type: "create", fund: null })}
            >
              <MaterialIcon className="text-[18px]" name="add" />
              <span>Mở sổ tiết kiệm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng tiền gửi tiết kiệm</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
              <MaterialIcon className="text-[18px]" name="savings" />
            </span>
          </div>
          <div className="text-2xl font-black text-[#173A67]">{formatVnd(totalSavingsBalance)}</div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {savingsFunds.length} sổ tiết kiệm đang theo dõi
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lãi suất cố định</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
              <MaterialIcon className="text-[18px]" name="lock" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-800">{fixedFunds.length} sổ</div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Lãi ước tính: <b className="text-emerald-700">{formatVnd(fixedMonthlyInterest)}</b>/tháng
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lãi suất thả nổi</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <MaterialIcon className="text-[18px]" name="trending_up" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-900">{floatingFunds.length} sổ</div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {floatingCountUnentered > 0 ? (
              <span className="text-amber-800 font-semibold">
                Tháng trước còn {floatingCountUnentered} sổ chưa nhập lãi
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">Đã nhập đủ lãi tháng trước</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Đáo hạn / Quá hạn</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-800">
              <MaterialIcon className="text-[18px]" name="event_busy" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700">{dueSavingsCount} sổ</div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {dueSavingsCount > 0 ? "Cần tất toán hoặc tái tục kỳ mới" : "Không có sổ nào quá hạn"}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-outline-variant">
        <div className="flex gap-2">
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === "list"
                ? "border-[#173A67] text-[#173A67]"
                : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("list")}
          >
            <MaterialIcon className="text-[18px]" name="list_alt" />
            <span>Danh sách sổ tiết kiệm ({savingsFunds.length})</span>
          </button>

          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === "floating"
                ? "border-[#173A67] text-[#173A67]"
                : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("floating")}
          >
            <MaterialIcon className="text-[18px]" name="trending_up" />
            <span>Tính lãi thả nổi hàng tháng</span>
            {floatingCountUnentered > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                {floatingCountUnentered}
              </span>
            )}
          </button>

          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === "guide"
                ? "border-[#173A67] text-[#173A67]"
                : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
            }`}
            type="button"
            onClick={() => setActiveTab("guide")}
          >
            <MaterialIcon className="text-[18px]" name="menu_book" />
            <span>Quy định & Hướng dẫn</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Danh sách tất cả các sổ */}
      {activeTab === "list" && (
        <SavingsBookList
          canManage={canManage}
          canRecord={canRecord}
          entries={entries}
          savingsFunds={savingsFunds}
          today={today}
          onAddFund={() => setModalState({ type: "create", fund: null })}
          onEditFund={(fund) => setModalState({ type: "edit", fund })}
          onMatureFund={(fund) => setModalState({ type: "mature", fund })}
          onViewHistory={(fund) => setModalState({ type: "detail", fund })}
        />
      )}

      {/* Tab 2: Bảng tính lãi thả nổi hàng tháng (YÊU CẦU TRỌNG TÂM) */}
      {activeTab === "floating" && (
        <SavingsFloatingInterestTable
          allFunds={funds}
          canRecord={canRecord}
          entries={entries}
          floatingFunds={floatingFunds}
          today={today}
          onRefreshNeeded={() => router.refresh()}
        />
      )}

      {/* Tab 3: Hướng dẫn cơ chế lãi suất */}
      {activeTab === "guide" && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 space-y-5">
          <div className="flex items-center gap-2 text-[#173A67]">
            <MaterialIcon className="text-[24px]" name="school" />
            <h2 className="text-lg font-bold">Hướng dẫn quản lý sổ tiết kiệm & tính lãi tài chính công đoàn</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <MaterialIcon className="text-[20px]" name="lock" />
                <h3>1. Trường hợp Lãi suất cố định</h3>
              </div>
              <p className="text-xs text-blue-950/80 leading-relaxed">
                Áp dụng cho các hợp đồng tiền gửi có kỳ hạn mà ngân hàng cam kết mức lãi suất không đổi trong suốt kỳ hạn (ví dụ gửi 6 tháng lãi suất 4,5%/năm).
              </p>
              <ul className="text-xs text-blue-900 space-y-1 list-disc list-inside">
                <li><b>Tiền lãi hàng tháng:</b> <code>Tiền gốc × Lãi suất (%/năm) ÷ 12</code></li>
                <li><b>Tiền lãi cả kỳ hạn:</b> <code>Tiền gốc × Lãi suất (%/năm) × Số tháng kỳ hạn ÷ 12</code></li>
                <li>Kế toán chỉ cần nhập % lãi suất một lần khi mở sổ hoặc khi tái tục kỳ mới.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <MaterialIcon className="text-[20px]" name="trending_up" />
                <h3>2. Trường hợp Lãi suất thả nổi</h3>
              </div>
              <p className="text-xs text-amber-950/80 leading-relaxed">
                Áp dụng cho các sổ tiết kiệm hoặc hợp đồng tiền gửi có lãi suất điều chỉnh linh hoạt theo thị trường hoặc thông báo lãi suất từng tháng của ngân hàng.
              </p>
              <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
                <li>Cuối mỗi tháng (hoặc đầu tháng kế tiếp khi nhận bảng kê/sao kê từ ngân hàng), kế toán mở tab <b>&quot;Tính lãi thả nổi hàng tháng&quot;</b>.</li>
                <li>Hệ thống mặc định chọn kỳ tính lãi là tháng trước. Kế toán nhập <b>% Lãi suất áp dụng</b> của tháng đó cho từng sổ.</li>
                <li>Hệ thống tự động tính ra tiền lãi tháng của từng sổ. Kế toán bấm <b>Lưu</b>, sau đó có thể bấm <b>Ghi thu lãi</b> để sinh phiếu thu vào sổ quỹ một cách hoàn toàn tự động.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant p-4 space-y-2 text-xs text-on-surface-variant">
            <h4 className="font-bold text-on-surface flex items-center gap-1.5">
              <MaterialIcon className="text-[18px] text-[#173A67]" name="sync_alt" />
              <span>Quy trình chuyển quỹ & xử lý khi đáo hạn:</span>
            </h4>
            <p>
              • <b>Gửi tiết kiệm:</b> Sổ tiết kiệm là quỹ nhận tiền gửi, không thể chi trực tiếp. Khi gửi tiền, kế toán ghi phiếu <b>Chuyển quỹ</b> từ Quỹ tài khoản thanh toán hoặc Quỹ tiền mặt sang Sổ tiết kiệm.
            </p>
            <p>
              • <b>Đáo hạn (Tất toán / Tái tục):</b> Khi sổ đến hạn, hệ thống tự động nhắc nhở trước 7 ngày. Bấm <b>&quot;Đáo hạn&quot;</b> để Tất toán (chuyển gốc + lãi về tài khoản thanh toán và ngừng dùng sổ) hoặc Tái tục (ghi lãi nhập gốc hoặc trả về tài khoản, đặt ngày đáo hạn mới).
            </p>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa sổ tiết kiệm */}
      {(modalState.type === "create" || modalState.type === "edit") && (
        <SavingsBookModal
          fund={modalState.fund}
          spendableFunds={spendableFunds}
          today={today}
          onClose={() => setModalState({ type: null, fund: null })}
          onSuccess={(msg) => {
            setModalState({ type: null, fund: null });
            showToast(msg);
          }}
        />
      )}

      {/* Modal Xem chi tiết sổ */}
      {modalState.type === "detail" && modalState.fund && (
        <SavingsBookDetailModal
          entries={entries}
          fund={modalState.fund}
          today={today}
          onClose={() => setModalState({ type: null, fund: null })}
          onEdit={() => {
            const f = modalState.fund;
            setModalState({ type: "edit", fund: f });
          }}
          onMature={() => {
            const f = modalState.fund;
            setModalState({ type: "mature", fund: f });
          }}
        />
      )}

      {/* Dialog Tất toán / Tái tục sổ đáo hạn */}
      {modalState.type === "mature" && modalState.fund && (
        <SavingsMaturityDialog
          entries={entries}
          fund={modalState.fund}
          funds={funds}
          today={today}
          onClose={() => setModalState({ type: null, fund: null })}
          onDone={(msg) => {
            setModalState({ type: null, fund: null });
            showToast(msg);
          }}
        />
      )}
    </div>
  );
}
