/**
 * Báo cáo tổng hợp (Bước 9): tính từ dữ liệu sổ quỹ, đề nghị thăm hỏi, đề nghị thanh toán.
 * Chỉ số liệu gộp – không có tên / thông tin cá nhân đoàn viên.
 */
import {
  compareEntries,
  type CategoryKind,
  type Fund,
  type FundCategory,
  type FundEntry,
  type FundKind,
} from "@/lib/finance/registry";
import {
  leafCodes,
  lineDepth,
  lineTitle,
  sideLines,
  type TemplateLine,
  type TemplateLineType,
} from "@/lib/report-templates/registry";
import { LIFE_EVENT_TYPES } from "@/lib/life-events/registry";
import { VISIT_STATUS_LABEL, type VisitStatus } from "@/lib/visits/registry";

export type Granularity = "month" | "quarter";

export function periodCount(g: Granularity): number {
  return g === "month" ? 12 : 4;
}

export function periodLabels(g: Granularity): string[] {
  return g === "month"
    ? Array.from({ length: 12 }, (_, i) => `T${i + 1}`)
    : ["Quý I", "Quý II", "Quý III", "Quý IV"];
}

/** Vị trí kỳ (0-based) của ngày YYYY-MM-DD trong năm. */
export function periodIndex(date: string, g: Granularity): number {
  const month = Number(date.slice(5, 7)) - 1;
  return g === "month" ? month : Math.floor(month / 3);
}

const zeros = (n: number) => Array.from({ length: n }, () => 0);

// ---------------------------------------------------------------------------
// Tài chính
// ---------------------------------------------------------------------------
export type CategoryRow = {
  id: string;
  code: string | null;
  name: string;
  reportGroup: string | null;
  values: number[];
  total: number;
  previousYear: number;
};

export type CategoryGroup = {
  rows: CategoryRow[];
  totals: number[];
  total: number;
  previousYear: number;
};

export type FundYearRow = {
  id: string;
  name: string;
  kind: FundKind;
  opening: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  closing: number;
};

/** Dòng của bảng tổng hợp theo mẫu báo cáo đang áp dụng. */
export type SummaryRow = {
  key: string;
  /** "Đoàn phí công đoàn (22)"; dòng cộng không kèm mã. */
  title: string;
  lineType: TemplateLineType | "unclassified";
  /** Độ sâu trong nhóm (0 = dòng gốc). */
  level: number;
  values: number[];
  total: number;
  previousYear: number;
};

export const UNCLASSIFIED_KEY = "_none";

function buildSummary(kind: CategoryKind, group: CategoryGroup, n: number, lines: TemplateLine[]): SummaryRow[] {
  const side = sideLines(lines, kind);
  const blank = (): Pick<SummaryRow, "values" | "total" | "previousYear"> => ({ values: zeros(n), total: 0, previousYear: 0 });
  const items = new Map(side.filter((l) => l.line_type === "item").map((l) => [l.code, blank()]));
  const none = blank();
  for (const r of group.rows) {
    const target = (r.reportGroup && items.get(r.reportGroup)) || none;
    r.values.forEach((v, i) => (target.values[i] += v));
    target.total += r.total;
    target.previousYear += r.previousYear;
  }
  const rows: SummaryRow[] = side.map((line) => {
    const sum = blank();
    for (const code of leafCodes(side, kind, line.code)) {
      const item = items.get(code);
      if (!item) continue;
      item.values.forEach((v, i) => (sum.values[i] += v));
      sum.total += item.total;
      sum.previousYear += item.previousYear;
    }
    return { key: line.code, title: lineTitle(line), lineType: line.line_type, level: lineDepth(side, line), ...sum };
  });
  if (none.total || none.previousYear) {
    rows.push({ key: UNCLASSIFIED_KEY, title: "Chưa phân loại", lineType: "unclassified", level: 0, ...none });
  }
  return rows;
}

export type FinanceReport = {
  income: CategoryGroup;
  expense: CategoryGroup;
  summary: { income: SummaryRow[]; expense: SummaryRow[] };
  net: number[];
  funds: FundYearRow[];
  /** Ngày chốt số dư cuối kỳ (hết năm, hoặc hôm nay nếu là năm hiện tại). */
  closingDate: string;
};

function buildGroup(
  kind: "income" | "expense",
  year: number,
  g: Granularity,
  categories: FundCategory[],
  entries: FundEntry[],
): CategoryGroup {
  const n = periodCount(g);
  const prefix = String(year);
  const prevPrefix = String(year - 1);
  const map = new Map<string, CategoryRow>();
  for (const c of categories) {
    if (c.kind !== kind) continue;
    map.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      reportGroup: c.report_group,
      values: zeros(n),
      total: 0,
      previousYear: 0,
    });
  }
  for (const e of entries) {
    if (e.status !== "posted" || e.kind !== kind || !e.category_id) continue;
    const row = map.get(e.category_id);
    if (!row) continue;
    if (e.entry_date.startsWith(prefix)) {
      row.values[periodIndex(e.entry_date, g)] += e.amount;
      row.total += e.amount;
    } else if (e.entry_date.startsWith(prevPrefix)) {
      row.previousYear += e.amount;
    }
  }
  const active = new Set(categories.filter((c) => c.is_active).map((c) => c.id));
  const rows = [...map.values()].filter((r) => active.has(r.id) || r.total !== 0 || r.previousYear !== 0);
  const totals = zeros(n);
  for (const r of rows) r.values.forEach((v, i) => (totals[i] += v));
  return {
    rows,
    totals,
    total: rows.reduce((s, r) => s + r.total, 0),
    previousYear: rows.reduce((s, r) => s + r.previousYear, 0),
  };
}

export function buildFinanceReport(
  year: number,
  g: Granularity,
  funds: Fund[],
  categories: FundCategory[],
  entries: FundEntry[],
  today: string,
  templateLines: TemplateLine[],
): FinanceReport {
  const income = buildGroup("income", year, g, categories, entries);
  const expense = buildGroup("expense", year, g, categories, entries);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const closingDate = today < end && today.startsWith(String(year)) ? today : end;

  const sorted = [...entries].sort(compareEntries);
  const fundRows: FundYearRow[] = [];
  for (const f of funds) {
    const row: FundYearRow = {
      id: f.id,
      name: f.name,
      kind: f.kind,
      opening: f.opening_balance,
      income: 0,
      expense: 0,
      transferIn: 0,
      transferOut: 0,
      closing: 0,
    };
    for (const e of sorted) {
      if (e.status !== "posted" || e.entry_date > end) continue;
      const before = e.entry_date < start;
      const delta =
        e.kind === "income" && e.fund_id === f.id
          ? { income: e.amount }
          : e.kind === "expense" && e.fund_id === f.id
            ? { expense: e.amount }
            : e.kind === "transfer" && e.to_fund_id === f.id
              ? { transferIn: e.amount }
              : e.kind === "transfer" && e.fund_id === f.id
                ? { transferOut: e.amount }
                : null;
      if (!delta) continue;
      const signed = (delta.income ?? 0) + (delta.transferIn ?? 0) - (delta.expense ?? 0) - (delta.transferOut ?? 0);
      if (before) {
        row.opening += signed;
        continue;
      }
      row.income += delta.income ?? 0;
      row.expense += delta.expense ?? 0;
      row.transferIn += delta.transferIn ?? 0;
      row.transferOut += delta.transferOut ?? 0;
    }
    row.closing = row.opening + row.income + row.transferIn - row.expense - row.transferOut;
    if (f.is_active || row.opening !== 0 || row.closing !== 0 || row.income || row.expense) fundRows.push(row);
  }

  return {
    income,
    expense,
    summary: {
      income: buildSummary("income", income, periodCount(g), templateLines),
      expense: buildSummary("expense", expense, periodCount(g), templateLines),
    },
    net: income.totals.map((v, i) => v - expense.totals[i]),
    funds: fundRows,
    closingDate,
  };
}

export const FUND_AMOUNT_KEYS = ["opening", "income", "expense", "transferIn", "transferOut", "closing"] as const;
export type FundTotals = Record<(typeof FUND_AMOUNT_KEYS)[number], number>;

export function sumFunds(rows: FundYearRow[]): FundTotals {
  const totals = Object.fromEntries(FUND_AMOUNT_KEYS.map((k) => [k, 0])) as FundTotals;
  for (const r of rows) for (const k of FUND_AMOUNT_KEYS) totals[k] += r[k];
  return totals;
}

/** Tách tiền chi được (tiền mặt + tài khoản thanh toán) và tiền gửi tiết kiệm; null nếu không có sổ tiết kiệm. */
export function splitFundTotals(rows: FundYearRow[]): { spendable: FundTotals; savings: FundTotals } | null {
  if (!rows.some((r) => r.kind === "savings")) return null;
  return {
    spendable: sumFunds(rows.filter((r) => r.kind !== "savings")),
    savings: sumFunds(rows.filter((r) => r.kind === "savings")),
  };
}

// ---------------------------------------------------------------------------
// Thăm hỏi
// ---------------------------------------------------------------------------
export type VisitInfo = { event_type: string | null; amount: number; status: VisitStatus; created_date: string };

export type VisitRow = { key: string; label: string; counts: number[]; amounts: number[]; count: number; amount: number };

export type VisitReport = {
  rows: VisitRow[];
  totalCounts: number[];
  totalAmounts: number[];
  count: number;
  amount: number;
  byStatus: { status: VisitStatus; label: string; count: number; amount: number }[];
};

/** Số phiếu & số tiền thăm hỏi đã duyệt / đã chi theo loại sự việc (theo ngày lập phiếu). */
export function buildVisitReport(year: number, g: Granularity, visits: VisitInfo[]): VisitReport {
  const n = periodCount(g);
  const prefix = String(year);
  const rows = new Map<string, VisitRow>();
  const rowFor = (key: string, label: string) => {
    let row = rows.get(key);
    if (!row) {
      row = { key, label, counts: zeros(n), amounts: zeros(n), count: 0, amount: 0 };
      rows.set(key, row);
    }
    return row;
  };
  const statusOrder: VisitStatus[] = ["proposed", "approved", "paid", "rejected", "cancelled"];
  const byStatus = new Map(statusOrder.map((s) => [s, { status: s, label: VISIT_STATUS_LABEL[s], count: 0, amount: 0 }]));

  for (const v of visits) {
    if (!v.created_date.startsWith(prefix)) continue;
    const st = byStatus.get(v.status);
    if (st) {
      st.count += 1;
      st.amount += v.amount;
    }
    if (v.status !== "approved" && v.status !== "paid") continue;
    const type = LIFE_EVENT_TYPES.find((t) => t.code === v.event_type);
    const row = rowFor(type?.code ?? "_none", type?.label ?? "Không ghi loại sự việc");
    const i = periodIndex(v.created_date, g);
    row.counts[i] += 1;
    row.amounts[i] += v.amount;
    row.count += 1;
    row.amount += v.amount;
  }

  const order = [...LIFE_EVENT_TYPES.map((t) => t.code), "_none"];
  const sortedRows = [...rows.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const totalCounts = zeros(n);
  const totalAmounts = zeros(n);
  for (const r of sortedRows) {
    r.counts.forEach((v, i) => (totalCounts[i] += v));
    r.amounts.forEach((v, i) => (totalAmounts[i] += v));
  }
  return {
    rows: sortedRows,
    totalCounts,
    totalAmounts,
    count: sortedRows.reduce((s, r) => s + r.count, 0),
    amount: sortedRows.reduce((s, r) => s + r.amount, 0),
    byStatus: [...byStatus.values()],
  };
}

// ---------------------------------------------------------------------------
// Đề nghị thanh toán
// ---------------------------------------------------------------------------
export type PaymentInfo = { request_date: string; status: VisitStatus; total_amount: number };

export type PaymentReport = {
  paidAmounts: number[];
  paidCounts: number[];
  byStatus: { status: VisitStatus; label: string; count: number; amount: number }[];
};

export function buildPaymentReport(year: number, g: Granularity, payments: PaymentInfo[]): PaymentReport {
  const n = periodCount(g);
  const prefix = String(year);
  const paidAmounts = zeros(n);
  const paidCounts = zeros(n);
  const statusOrder: VisitStatus[] = ["proposed", "approved", "paid", "rejected", "cancelled"];
  const byStatus = new Map(statusOrder.map((s) => [s, { status: s, label: VISIT_STATUS_LABEL[s], count: 0, amount: 0 }]));
  for (const p of payments) {
    if (!p.request_date.startsWith(prefix)) continue;
    const st = byStatus.get(p.status);
    if (st) {
      st.count += 1;
      st.amount += p.total_amount;
    }
    if (p.status === "paid") {
      const i = periodIndex(p.request_date, g);
      paidAmounts[i] += p.total_amount;
      paidCounts[i] += 1;
    }
  }
  return { paidAmounts, paidCounts, byStatus: [...byStatus.values()] };
}

/** Các năm có dữ liệu (luôn gồm năm hiện tại), mới nhất trước. */
export function availableYears(currentYear: number, dates: string[]): number[] {
  const years = new Set<number>([currentYear]);
  for (const d of dates) {
    const y = Number(d.slice(0, 4));
    if (y >= 2000 && y <= currentYear) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
