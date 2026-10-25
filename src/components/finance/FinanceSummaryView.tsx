"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { FinanceImportModal } from "@/components/finance/FinanceImportModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Fund, FundCategory, FundEntry } from "@/lib/finance/registry";
import {
  collectAvailableYears,
  computeFinanceSummary,
  type CategorySummaryRow,
  type StoredOpeningBalances,
  type SummaryDetailRow,
  type SummaryFilter,
  type SummaryPeriodType,
} from "@/lib/finance/summary";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  funds: Fund[];
  categories: FundCategory[];
  entries: FundEntry[];
  entryNotes: Record<string, string>;
  initialOpeningBalances: StoredOpeningBalances;
  initialFilter: SummaryFilter;
  today: string;
  canWrite: boolean;
};

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const QUARTER_OPTIONS = [
  { value: 1, label: "Quý I (T1 – T3)" },
  { value: 2, label: "Quý II (T4 – T6)" },
  { value: 3, label: "Quý III (T7 – T9)" },
  { value: 4, label: "Quý IV (T10 – T12)" },
];

export function FinanceSummaryView({
  funds,
  categories,
  entries,
  entryNotes,
  initialOpeningBalances,
  initialFilter,
  today,
  canWrite,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<SummaryFilter>(initialFilter);
  const [openingBalances, setOpeningBalances] = useState<StoredOpeningBalances>(initialOpeningBalances);
  const [includeZeroCategories, setIncludeZeroCategories] = useState(true);

  const [editingOpening, setEditingOpening] = useState(false);
  const [openingAmountInput, setOpeningAmountInput] = useState("");
  const [openingNoteInput, setOpeningNoteInput] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [openingMessage, setOpeningMessage] = useState<string | null>(null);

  const years = useMemo(
    () => collectAvailableYears(entries, openingBalances, today),
    [entries, openingBalances, today],
  );

  const summary = useMemo(
    () =>
      computeFinanceSummary({
        filter,
        funds,
        categories,
        entries,
        entryNotes,
        openingBalances,
        includeZeroCategories,
      }),
    [filter, funds, categories, entries, entryNotes, openingBalances, includeZeroCategories],
  );

  function openOpeningEditor() {
    const manual = openingBalances.periods[summary.periodKey];
    setOpeningAmountInput(String(manual ? manual.amount : Math.max(0, summary.openingBalance)));
    setOpeningNoteInput(manual?.note ?? "");
    setOpeningError(null);
    setOpeningMessage(null);
    setEditingOpening(true);
  }

  async function saveOpening(amountToSave: number | null) {
    setSavingOpening(true);
    setOpeningError(null);
    setOpeningMessage(null);
    try {
      const res = await fetch("/api/finance/summary/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodKey: summary.periodKey,
          fromDate: summary.fromDate,
          amount: amountToSave,
          note: openingNoteInput.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        openingBalances?: StoredOpeningBalances;
      };
      if (!res.ok) {
        setOpeningError(data.error ?? "Không lưu được số dư đầu kỳ.");
        return;
      }
      if (data.openingBalances) {
        setOpeningBalances(data.openingBalances);
      }
      setEditingOpening(false);
      setOpeningMessage(
        amountToSave === null
          ? `Đã chuyển số dư đầu kỳ ${summary.periodLabel} về chế độ tự động kết chuyển.`
          : `Đã lưu số dư đầu kỳ kết chuyển cho ${summary.periodLabel}.`,
      );
      router.refresh();
    } catch {
      setOpeningError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSavingOpening(false);
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({
      periodType: filter.periodType,
      year: String(filter.year),
      month: String(filter.month),
      quarter: String(filter.quarter),
      includeZero: includeZeroCategories ? "1" : "0",
    });
    return `/api/finance/summary/export?${params.toString()}`;
  }, [filter, includeZeroCategories]);

  const detailColumns: DataTableColumn<SummaryDetailRow>[] = [
    {
      key: "entryDate",
      header: "Ngày",
      type: "date",
      accessor: (r) => r.entryDate,
      className: "whitespace-nowrap",
      render: (r) => formatDateVi(r.entryDate),
    },
    {
      key: "code",
      header: "Số phiếu",
      accessor: (r) => r.code,
      className: "whitespace-nowrap",
      render: (r) => (
        <Link className="font-bold text-[#173A67] hover:underline" href={`/office/finance/${r.id}`}>
          {r.code}
        </Link>
      ),
    },
    {
      key: "kind",
      header: "Loại",
      accessor: (r) => (r.kind === "income" ? "Thu" : "Chi"),
      className: "whitespace-nowrap",
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
            r.kind === "income" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {r.kind === "income" ? "Thu" : "Chi"}
        </span>
      ),
    },
    {
      key: "categoryName",
      header: "Danh mục",
      accessor: (r) => r.categoryName,
      className: "min-w-[180px] font-medium text-[#173A67]",
    },
    {
      key: "description",
      header: "Nội dung",
      accessor: (r) => r.description,
      className: "min-w-[240px]",
    },
    {
      key: "amount",
      header: "Số tiền",
      type: "number",
      accessor: (r) => r.amount,
      headerClassName: "text-right",
      className: "whitespace-nowrap text-right font-bold",
      render: (r) => (
        <span className={r.kind === "income" ? "text-emerald-700" : "text-rose-700"}>
          {r.kind === "income" ? "+" : "-"}
          {formatVnd(r.amount)}
        </span>
      ),
    },
    {
      key: "note",
      header: "Ghi chú",
      accessor: (r) => r.note ?? "",
      className: "min-w-[160px] text-xs text-on-surface-variant",
      render: (r) => r.note ?? "—",
    },
  ];

  function renderCategoryTable(params: {
    title: string;
    subtitle: string;
    icon: string;
    tone: "income" | "expense";
    rows: CategorySummaryRow[];
    totalAmount: number;
    totalCount: number;
  }) {
    const isIncome = params.tone === "income";
    const amountColor = isIncome ? "text-emerald-700" : "text-rose-700";
    const badgeBg = isIncome ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200";

    return (
      <section className="flex flex-col rounded-2xl border border-outline-variant bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#173A67]">
              <MaterialIcon className={`text-[20px] ${amountColor}`} name={params.icon} />
              {params.title}
            </h2>
            <p className="text-xs text-on-surface-variant">{params.subtitle}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeBg}`}>
            {params.totalCount} bút toán · {formatVnd(params.totalAmount)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC]/70 text-xs font-bold text-[#173A67]">
              <tr className="[&>th]:px-3.5 [&>th]:py-2.5 [&>th]:whitespace-nowrap">
                <th className="w-12 text-center">STT</th>
                <th>Danh mục {isIncome ? "thu" : "chi"}</th>
                <th className="text-right">Số phiếu</th>
                <th className="text-right">Tổng tiền</th>
                <th className="text-right">Tỷ trọng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {params.rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan={5}>
                    Chưa có khoản {isIncome ? "thu" : "chi"} nào trong {summary.periodLabel}.
                  </td>
                </tr>
              ) : (
                params.rows.map((r, idx) => (
                  <tr
                    key={r.categoryId}
                    className={`transition hover:bg-surface-container-lowest [&>td]:px-3.5 [&>td]:py-2.5 ${
                      r.totalAmount === 0 ? "text-on-surface-variant/75" : ""
                    }`}
                  >
                    <td className="text-center text-xs font-semibold text-on-surface-variant">{idx + 1}</td>
                    <td>
                      <p className="font-semibold text-on-surface">
                        {r.code ? (
                          <span className="mr-1.5 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-bold text-[#173A67]">
                            {r.code}
                          </span>
                        ) : null}
                        {r.name}
                      </p>
                      {r.sampleNote ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
                          VD: {r.sampleNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-right font-medium">
                      {r.entryCount > 0 ? r.entryCount : "–"}
                    </td>
                    <td className={`whitespace-nowrap text-right font-bold ${r.totalAmount > 0 ? amountColor : ""}`}>
                      {r.totalAmount > 0 ? formatVnd(r.totalAmount) : "0 đ"}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs font-semibold text-on-surface-variant">
                      {r.totalAmount > 0 ? `${r.percentage.toFixed(1)}%` : "0%"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#173A67]/20 bg-surface-container-low/60 font-extrabold text-[#173A67] [&>td]:px-3.5 [&>td]:py-3">
                <td colSpan={2}>Tổng cộng {isIncome ? "thu" : "chi"}</td>
                <td className="whitespace-nowrap text-right">{params.totalCount}</td>
                <td className={`whitespace-nowrap text-right ${amountColor}`}>{formatVnd(params.totalAmount)}</td>
                <td className="whitespace-nowrap text-right">{params.totalAmount > 0 ? "100%" : "0%"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Thanh công cụ lọc kỳ + Nhập / Xuất Excel */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Lọc theo kỳ:</span>
          {(
            [
              { key: "month", label: "Theo Tháng" },
              { key: "quarter", label: "Theo Quý" },
              { key: "year", label: "Theo Năm" },
            ] as { key: SummaryPeriodType; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                filter.periodType === tab.key
                  ? "bg-[#173A67] text-white shadow-xs"
                  : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
              }`}
              type="button"
              onClick={() => {
                setEditingOpening(false);
                setFilter((prev) => ({ ...prev, periodType: tab.key }));
              }}
            >
              {tab.label}
            </button>
          ))}

          <select
            aria-label="Chọn năm"
            className={inputClass}
            value={filter.year}
            onChange={(e) => {
              setEditingOpening(false);
              setFilter((prev) => ({ ...prev, year: Number(e.target.value) }));
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>

          {filter.periodType === "month" ? (
            <select
              aria-label="Chọn tháng"
              className={inputClass}
              value={filter.month}
              onChange={(e) => {
                setEditingOpening(false);
                setFilter((prev) => ({ ...prev, month: Number(e.target.value) }));
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}/{filter.year}
                </option>
              ))}
            </select>
          ) : null}

          {filter.periodType === "quarter" ? (
            <select
              aria-label="Chọn quý"
              className={inputClass}
              value={filter.quarter}
              onChange={(e) => {
                setEditingOpening(false);
                setFilter((prev) => ({ ...prev, quarter: Number(e.target.value) }));
              }}
            >
              {QUARTER_OPTIONS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label} / {filter.year}
                </option>
              ))}
            </select>
          ) : null}

          <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
            <input
              checked={includeZeroCategories}
              className="h-4 w-4 accent-[#173A67]"
              type="checkbox"
              onChange={(e) => setIncludeZeroCategories(e.target.checked)}
            />
            Hiện danh mục 0 đ
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? <FinanceImportModal /> : null}
          <a
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#1E4A7D]"
            href={exportHref}
          >
            <MaterialIcon className="text-[18px]" name="download" />
            Xuất Excel ({summary.periodLabel})
          </a>
        </div>
      </div>

      {openingMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span>{openingMessage}</span>
          <button
            className="text-xs underline"
            type="button"
            onClick={() => setOpeningMessage(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}

      {/* 4 Thẻ chỉ số cân đối kỳ: Số dư đầu kỳ, Tổng thu, Tổng chi, Số dư cuối kỳ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-on-surface-variant">
                Số dư đầu kỳ ({formatDateVi(summary.fromDate)})
              </p>
              <p className="mt-1 text-xl font-extrabold text-[#173A67]">{formatVnd(summary.openingBalance)}</p>
            </div>
            {canWrite ? (
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-bold text-[#173A67] hover:border-[#173A67] hover:bg-[#173A67]/5"
                type="button"
                onClick={openOpeningEditor}
              >
                <MaterialIcon className="text-[14px]" name="edit" />
                {summary.openingSource === "manual" ? "Sửa đầu kỳ" : "Nhập đầu kỳ"}
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            {summary.openingSource === "manual" ? (
              <span className="font-semibold text-amber-800">
                Đã nhập từ sổ cũ{summary.openingNote ? `: ${summary.openingNote}` : ""}
              </span>
            ) : summary.openingSource === "carried" ? (
              <span>Tự động kết chuyển từ {summary.openingCheckpointLabel}</span>
            ) : (
              <span>Tự động tính từ số dư các quỹ &amp; kỳ trước</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-white p-4">
          <p className="text-xs font-bold text-on-surface-variant">Tổng thu ({summary.periodLabel})</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatVnd(summary.totalIncome)}</p>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            {summary.incomeEntryCount} phiếu thu trong kỳ
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-white p-4">
          <p className="text-xs font-bold text-on-surface-variant">Tổng chi ({summary.periodLabel})</p>
          <p className="mt-1 text-xl font-extrabold text-rose-700">{formatVnd(summary.totalExpense)}</p>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            {summary.expenseEntryCount} phiếu chi trong kỳ
          </p>
        </div>

        <div className="rounded-2xl border border-[#173A67]/30 bg-[#173A67]/[0.03] p-4">
          <p className="text-xs font-bold text-[#173A67]">
            Số dư cuối kỳ ({formatDateVi(summary.toDate)})
          </p>
          <p
            className={`mt-1 text-xl font-extrabold ${
              summary.closingBalance < 0 ? "text-rose-700" : "text-[#173A67]"
            }`}
          >
            {formatVnd(summary.closingBalance)}
          </p>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            Chênh lệch kỳ:{" "}
            <strong className={summary.netAmount < 0 ? "text-rose-700" : "text-emerald-700"}>
              {summary.netAmount >= 0 ? "+" : ""}
              {formatVnd(summary.netAmount)}
            </strong>
          </p>
        </div>
      </div>

      {/* Khung nhập / điều chỉnh số dư đầu kỳ kết chuyển từ sổ cũ */}
      {editingOpening ? (
        <section className="space-y-3 rounded-2xl border border-[#173A67]/40 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#173A67]">
                Số dư đầu kỳ kết chuyển cho {summary.periodLabel} (tại ngày {formatDateVi(summary.fromDate)})
              </h3>
              <p className="text-xs text-on-surface-variant">
                Nhập số dư chuyển sang từ sổ sách cũ để tiếp tục theo dõi từ kỳ này mà không cần nhập lại toàn bộ lịch sử trước đó. Các kỳ tiếp theo sẽ tự động cộng dồn từ mốc này.
              </p>
            </div>
            <button
              className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
              type="button"
              onClick={() => setEditingOpening(false)}
            >
              <MaterialIcon name="close" />
            </button>
          </div>

          {openingError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {openingError}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                Số dư đầu kỳ ({summary.periodLabel}) – VNĐ *
              </label>
              <input
                className={`${inputClass} w-full font-bold text-[#173A67]`}
                inputMode="numeric"
                placeholder="VD: 50.000.000"
                value={
                  openingAmountInput
                    ? new Intl.NumberFormat("vi-VN").format(Number(openingAmountInput))
                    : ""
                }
                onChange={(e) => setOpeningAmountInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                Ghi chú nguồn kết chuyển (tùy chọn)
              </label>
              <input
                className={`${inputClass} w-full`}
                maxLength={250}
                placeholder="VD: Kết chuyển từ sổ quỹ giấy chốt cuối quý trước"
                value={openingNoteInput}
                onChange={(e) => setOpeningNoteInput(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
              disabled={savingOpening}
              type="button"
              onClick={() => void saveOpening(Number(openingAmountInput || 0))}
            >
              <MaterialIcon className="text-[18px]" name="save" />
              {savingOpening ? "Đang lưu..." : "Lưu số dư đầu kỳ"}
            </button>
            {summary.openingSource === "manual" ? (
              <button
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                disabled={savingOpening}
                type="button"
                onClick={() => void saveOpening(null)}
              >
                <MaterialIcon className="text-[18px]" name="restart_alt" />
                Xóa mốc nhập tay (dùng lại tự động kết chuyển)
              </button>
            ) : null}
            <button
              className="rounded-xl border border-outline-variant px-3.5 py-2 text-sm font-semibold text-on-surface-variant hover:border-[#173A67]"
              disabled={savingOpening}
              type="button"
              onClick={() => setEditingOpening(false)}
            >
              Hủy
            </button>
          </div>
        </section>
      ) : null}

      {/* Hai bảng tổng hợp: Tổng hợp thu & Tổng hợp chi theo danh mục */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {renderCategoryTable({
          title: "Tổng hợp thu",
          subtitle: `Nhóm theo danh mục thu (${summary.periodLabel})`,
          icon: "south_west",
          tone: "income",
          rows: summary.incomeRows,
          totalAmount: summary.totalIncome,
          totalCount: summary.incomeEntryCount,
        })}

        {renderCategoryTable({
          title: "Tổng hợp chi",
          subtitle: `Nhóm theo danh mục chi (${summary.periodLabel})`,
          icon: "north_east",
          tone: "expense",
          rows: summary.expenseRows,
          totalAmount: summary.totalExpense,
          totalCount: summary.expenseEntryCount,
        })}
      </div>

      {/* Bảng chi tiết các bút toán phát sinh trong kỳ */}
      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#173A67]">
              <MaterialIcon className="text-[20px]" name="receipt_long" />
              Chi tiết phát sinh thu – chi trong {summary.periodLabel}
            </h2>
            <p className="text-xs text-on-surface-variant">
              Từ ngày {formatDateVi(summary.fromDate)} đến ngày {formatDateVi(summary.toDate)} ({summary.detailRows.length} bút toán). Khi xuất Excel sẽ bao gồm cả bảng tổng hợp và toàn bộ danh sách chi tiết này.
            </p>
          </div>
        </div>

        <DataTable
          columns={detailColumns}
          defaultPageSize={20}
          emptyText={`Không có phát sinh thu – chi nào trong ${summary.periodLabel}.`}
          footerRows={
            <tr className="border-t-2 border-[#173A67]/20 font-bold text-[#173A67] [&>td]:px-4 [&>td]:py-3">
              <td colSpan={5}>
                Cộng phát sinh trong {summary.periodLabel} (Thu: {formatVnd(summary.totalIncome)} · Chi:{" "}
                {formatVnd(summary.totalExpense)})
              </td>
              <td className="whitespace-nowrap text-right">
                {summary.netAmount >= 0 ? "+" : ""}
                {formatVnd(summary.netAmount)}
              </td>
              <td>Cuối kỳ: {formatVnd(summary.closingBalance)}</td>
            </tr>
          }
          rowKey={(r) => r.id}
          rows={summary.detailRows}
        />
      </section>
    </div>
  );
}
