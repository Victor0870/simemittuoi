"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  ENTRY_KIND_LABEL,
  FUND_KIND_ICON,
  compareEntries,
  entryEffect,
  entryTouchesFund,
  fundBalance,
  fundSubtitle,
  isSpendableFund,
  type EntryKind,
  type Fund,
  type FundCategory,
  type FundEntry,
} from "@/lib/finance/registry";
import { formatDateVi } from "@/lib/members/profile-shared";
import { formatVnd } from "@/lib/visits/registry";

type Props = {
  funds: Fund[];
  categories: FundCategory[];
  entries: FundEntry[];
  lockedThrough: string | null;
  today: string;
  unionName: string;
};

const inputClass =
  "rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-[#173A67]";

function fold(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function periods(today: string) {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${y}-${pad(m)}-01`;
  const prevMonthEnd = shiftDay(monthStart, -1);
  const quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
  return [
    { key: "month", label: "Tháng này", from: monthStart, to: today },
    { key: "prev", label: "Tháng trước", from: `${prevMonthEnd.slice(0, 7)}-01`, to: prevMonthEnd },
    { key: "quarter", label: "Quý này", from: `${y}-${pad(quarterStartMonth)}-01`, to: today },
    { key: "year", label: "Năm nay", from: `${y}-01-01`, to: today },
  ];
}

type Row = { entry: FundEntry; income: number; expense: number; balance: number | null };

export function FundLedger({ funds, categories, entries, lockedThrough, today, unionName }: Props) {
  const presets = useMemo(() => periods(today), [today]);
  const [fundId, setFundId] = useState<string>("all");
  const [from, setFrom] = useState(presets[3].from);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<EntryKind | "all">("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fundById = useMemo(() => new Map(funds.map((f) => [f.id, f])), [funds]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selectedFund = fundId === "all" ? null : (fundById.get(fundId) ?? null);
  const scope = selectedFund?.id ?? null;

  const balances = useMemo(
    () => funds.map((f) => ({ fund: f, balance: fundBalance(f, entries) })).filter((b) => b.fund.is_active || b.balance !== 0),
    [funds, entries],
  );
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);
  const savingsBalance = balances.reduce((sum, b) => sum + (isSpendableFund(b.fund) ? 0 : b.balance), 0);
  const hasSavings = funds.some((f) => !isSpendableFund(f));

  const ledger = useMemo(() => {
    const scopeFunds = selectedFund ? [selectedFund] : funds;
    const sorted = [...entries].sort(compareEntries);
    let opening = scopeFunds.reduce((sum, f) => sum + f.opening_balance, 0);
    for (const e of sorted) if (e.entry_date < from) opening += entryEffect(e, scope);

    const q = fold(search.trim());
    let running = opening;
    let income = 0;
    let expense = 0;
    const rows: Row[] = [];
    for (const e of sorted) {
      if (e.entry_date < from || e.entry_date > to || !entryTouchesFund(e, scope)) continue;
      const effect = entryEffect(e, scope);
      running += effect;
      if (e.status === "posted") {
        if (effect > 0) income += effect;
        if (effect < 0) expense -= effect;
      }
      if (e.status === "void" && !showVoid) continue;
      if (kind !== "all" && e.kind !== kind) continue;
      if (categoryId !== "all" && e.category_id !== categoryId) continue;
      if (q) {
        const hay = fold([e.code, e.description, e.counterparty, e.document_no].filter(Boolean).join(" "));
        if (!hay.includes(q)) continue;
      }
      const display =
        e.kind === "transfer" && scope === null
          ? { income: 0, expense: 0 }
          : { income: Math.max(entryEffect({ ...e, status: "posted" }, scope), 0), expense: Math.max(-entryEffect({ ...e, status: "posted" }, scope), 0) };
      rows.push({ entry: e, ...display, balance: e.status === "posted" ? running : null });
    }
    return { opening, income, expense, closing: opening + income - expense, rows };
  }, [entries, funds, selectedFund, scope, from, to, kind, categoryId, search, showVoid]);

  const filtered = kind !== "all" || categoryId !== "all" || search.trim() !== "";

  function describe(e: FundEntry): string {
    if (e.kind === "transfer") {
      return `${fundById.get(e.fund_id)?.name ?? "?"} → ${fundById.get(e.to_fund_id ?? "")?.name ?? "?"}`;
    }
    return categoryById.get(e.category_id ?? "")?.name ?? "";
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const title = selectedFund ? `SỔ QUỸ ${selectedFund.name.toUpperCase()}` : "SỔ QUỸ (TẤT CẢ CÁC QUỸ)";
      const header = ["Ngày", "Số phiếu thu", "Số phiếu chi", "Diễn giải", "Danh mục", "Người nộp / nhận", "Thu", "Chi", "Tồn"];
      const data = ledger.rows.map((r) => [
        formatDateVi(r.entry.entry_date),
        r.income > 0 ? r.entry.code : "",
        r.expense > 0 || (r.entry.kind === "transfer" && r.income === 0) ? r.entry.code : "",
        r.entry.status === "void" ? `[ĐÃ HỦY] ${r.entry.description}` : r.entry.description,
        describe(r.entry),
        r.entry.counterparty ?? "",
        r.income || "",
        r.expense || "",
        r.balance ?? "",
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([
        [unionName],
        [title],
        [`Từ ngày ${formatDateVi(from)} đến ngày ${formatDateVi(to)}${filtered ? " (đang lọc)" : ""}`],
        [],
        header,
        ["", "", "", "Số dư đầu kỳ", "", "", "", "", ledger.opening],
        ...data,
        ["", "", "", "Cộng phát sinh trong kỳ", "", "", ledger.income, ledger.expense, ""],
        ["", "", "", "Số dư cuối kỳ", "", "", "", "", ledger.closing],
      ]);
      const firstRow = 5;
      const lastRow = firstRow + data.length + 2;
      for (let r = firstRow; r <= lastRow; r++) {
        for (const c of [6, 7, 8]) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && typeof cell.v === "number") cell.z = "#,##0";
        }
      }
      sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: 8 } }));
      sheet["!cols"] = [12, 14, 14, 48, 30, 24, 15, 15, 16].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "So quy");
      XLSX.writeFile(book, `so_quy_${from}_${to}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map(({ fund, balance }) => (
          <button
            key={fund.id}
            className={`rounded-2xl border p-4 text-left transition ${
              fundId === fund.id ? "border-[#173A67] bg-[#173A67]/5" : "border-outline-variant bg-surface-container-lowest hover:border-[#173A67]/50"
            }`}
            type="button"
            onClick={() => setFundId(fundId === fund.id ? "all" : fund.id)}
          >
            <p className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
              <MaterialIcon className="text-[16px]" name={FUND_KIND_ICON[fund.kind]} />
              {fund.name}
              {!fund.is_active ? " (ngừng dùng)" : ""}
            </p>
            <p className={`mt-1 text-xl font-extrabold ${balance < 0 ? "text-rose-700" : "text-[#173A67]"}`}>{formatVnd(balance)}</p>
            <p className="text-[11px] text-on-surface-variant">{fundSubtitle(fund, formatDateVi)}</p>
          </button>
        ))}
        <button
          className={`rounded-2xl border p-4 text-left transition ${
            fundId === "all" ? "border-[#173A67] bg-[#173A67]/5" : "border-outline-variant bg-surface-container-lowest hover:border-[#173A67]/50"
          }`}
          type="button"
          onClick={() => setFundId("all")}
        >
          <p className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
            <MaterialIcon className="text-[16px]" name="account_balance_wallet" />
            Tổng các quỹ
          </p>
          <p className="mt-1 text-xl font-extrabold text-[#173A67]">{formatVnd(totalBalance)}</p>
          <p className="text-[11px] text-on-surface-variant">
            {hasSavings
              ? `Chi được ${formatVnd(totalBalance - savingsBalance)} · Tiết kiệm ${formatVnd(savingsBalance)}`
              : "Số dư hiện tại"}
          </p>
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass} value={fundId} onChange={(e) => setFundId(e.target.value)}>
            <option value="all">Tất cả các quỹ</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <input className={inputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-on-surface-variant">đến</span>
          <input className={inputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {presets.map((p) => (
            <button
              key={p.key}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                from === p.from && to === p.to
                  ? "bg-[#173A67] text-white"
                  : "border border-outline-variant bg-white text-on-surface-variant hover:border-[#173A67]"
              }`}
              type="button"
              onClick={() => {
                setFrom(p.from);
                setTo(p.to);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as EntryKind | "all")}>
            <option value="all">Mọi loại phiếu</option>
            {(Object.keys(ENTRY_KIND_LABEL) as EntryKind[]).map((k) => (
              <option key={k} value={k}>
                {ENTRY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">Mọi danh mục</option>
            <optgroup label="Thu">
              {categories
                .filter((c) => c.kind === "income")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Chi">
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <div className="relative min-w-[200px] flex-1">
            <MaterialIcon
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
              name="search"
            />
            <input
              className={`${inputClass} w-full pl-9`}
              placeholder="Tìm số phiếu, diễn giải, người nộp / nhận..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
            <input checked={showVoid} type="checkbox" onChange={(e) => setShowVoid(e.target.checked)} />
            Hiện phiếu đã hủy
          </label>
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-[#173A67] hover:border-[#173A67] disabled:opacity-60"
            disabled={exporting}
            type="button"
            onClick={() => void exportExcel()}
          >
            <MaterialIcon className="text-[18px]" name={exporting ? "progress_activity" : "download"} />
            Xuất sổ quỹ Excel
          </button>
        </div>
        {lockedThrough ? (
          <p className="text-xs text-amber-800">
            <MaterialIcon className="mr-0.5 align-[-3px] text-[14px]" name="lock" />
            Đã khóa sổ đến hết ngày {formatDateVi(lockedThrough)} – bút toán đến ngày này không sửa / hủy được.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tồn đầu kỳ", value: ledger.opening, tone: "text-on-surface" },
          { label: "Tổng thu", value: ledger.income, tone: "text-emerald-700" },
          { label: "Tổng chi", value: ledger.expense, tone: "text-rose-700" },
          { label: "Tồn cuối kỳ", value: ledger.closing, tone: "text-[#173A67]" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-outline-variant bg-white p-3">
            <p className="text-xs font-semibold text-on-surface-variant">{s.label}</p>
            <p className={`text-lg font-extrabold ${s.tone}`}>{formatVnd(s.value)}</p>
          </div>
        ))}
      </div>
      {fundId === "all" ? (
        <p className="text-xs text-on-surface-variant">
          Đang xem gộp mọi quỹ: chuyển tiền giữa các quỹ không tính vào thu / chi. Chọn một quỹ để xem sổ quỹ riêng.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#D9F2EC] text-[#173A67]">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-bold [&>th]:whitespace-nowrap">
              <th>Ngày</th>
              <th>Số phiếu</th>
              <th>Diễn giải</th>
              <th className="text-right">Thu</th>
              <th className="text-right">Chi</th>
              <th className="text-right">Tồn</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-outline-variant bg-surface-container-low/50 font-semibold [&>td]:px-3 [&>td]:py-2">
              <td colSpan={5}>Số dư đầu kỳ ({formatDateVi(from)})</td>
              <td className="text-right whitespace-nowrap">{formatVnd(ledger.opening)}</td>
            </tr>
            {ledger.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-on-surface-variant" colSpan={6}>
                  Không có phát sinh trong kỳ.
                </td>
              </tr>
            ) : null}
            {ledger.rows.map(({ entry: e, income, expense, balance }) => (
              <tr
                key={e.id}
                className={`border-t border-outline-variant hover:bg-surface-container-low/60 [&>td]:px-3 [&>td]:py-2 ${
                  e.status === "void" ? "text-on-surface-variant line-through" : ""
                }`}
              >
                <td className="whitespace-nowrap">{formatDateVi(e.entry_date)}</td>
                <td className="whitespace-nowrap">
                  <Link className="font-bold text-[#173A67] hover:underline" href={`/office/finance/${e.id}`}>
                    {e.code}
                  </Link>
                  {e.status === "void" ? <span className="ml-1 text-[11px] font-bold text-rose-700 no-underline">Đã hủy</span> : null}
                </td>
                <td className="max-w-[420px]">
                  <p className="line-clamp-2">{e.description}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {[describe(e), e.counterparty, e.document_no ? `CT: ${e.document_no}` : null].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="text-right font-semibold whitespace-nowrap text-emerald-700">{income ? formatVnd(income) : ""}</td>
                <td className="text-right font-semibold whitespace-nowrap text-rose-700">{expense ? formatVnd(expense) : ""}</td>
                <td className="text-right whitespace-nowrap">{balance === null ? "" : formatVnd(balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#173A67]/20 font-bold text-[#173A67] [&>td]:px-3 [&>td]:py-2.5">
              <td colSpan={3}>Cộng phát sinh{filtered ? " (cả kỳ, không theo bộ lọc)" : ""}</td>
              <td className="text-right whitespace-nowrap">{formatVnd(ledger.income)}</td>
              <td className="text-right whitespace-nowrap">{formatVnd(ledger.expense)}</td>
              <td className="text-right whitespace-nowrap">{formatVnd(ledger.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
