/**
 * Tổng hợp thu – chi công đoàn theo kỳ (Tháng / Quý / Năm),
 * hỗ trợ số dư đầu kỳ kết chuyển từ sổ cũ và gộp theo danh mục.
 */
import {
  compareEntries,
  entryEffect,
  type CategoryKind,
  type Fund,
  type FundCategory,
  type FundEntry,
} from "@/lib/finance/registry";

export type SummaryPeriodType = "month" | "quarter" | "year";

export type SummaryFilter = {
  periodType: SummaryPeriodType;
  year: number;
  /** 1..12 khi periodType = 'month' */
  month: number;
  /** 1..4 khi periodType = 'quarter' */
  quarter: number;
};

export type PeriodOpeningEntry = {
  periodKey: string;
  fromDate: string;
  amount: number;
  note: string | null;
  updatedAt: string;
};

export type StoredOpeningBalances = {
  periods: Record<string, PeriodOpeningEntry>;
};

export type CategorySummaryRow = {
  categoryId: string;
  code: string | null;
  name: string;
  kind: CategoryKind;
  isActive: boolean;
  entryCount: number;
  totalAmount: number;
  percentage: number;
  sampleNote: string | null;
};

export type SummaryDetailRow = {
  id: string;
  code: string;
  entryDate: string;
  kind: CategoryKind;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string;
  fundName: string;
  description: string;
  amount: number;
  note: string | null;
};

export type OpeningBalanceSource = "manual" | "carried" | "funds";

export type ComputedFinanceSummary = {
  periodKey: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  openingSource: OpeningBalanceSource;
  openingNote: string | null;
  openingCheckpointLabel: string | null;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  closingBalance: number;
  incomeRows: CategorySummaryRow[];
  expenseRows: CategorySummaryRow[];
  incomeEntryCount: number;
  expenseEntryCount: number;
  detailRows: SummaryDetailRow[];
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildPeriodKey(filter: SummaryFilter): string {
  if (filter.periodType === "month") return `month:${filter.year}-${pad2(filter.month)}`;
  if (filter.periodType === "quarter") return `quarter:${filter.year}-Q${filter.quarter}`;
  return `year:${filter.year}`;
}

export function formatPeriodKeyLabel(periodKey: string): string {
  const m = /^month:(\d{4})-(\d{2})$/.exec(periodKey);
  if (m) return `Tháng ${Number(m[2])}/${m[1]}`;
  const q = /^quarter:(\d{4})-Q([1-4])$/.exec(periodKey);
  if (q) {
    const roman = ["I", "II", "III", "IV"][Number(q[2]) - 1] ?? q[2];
    return `Quý ${roman}/${q[1]}`;
  }
  const y = /^year:(\d{4})$/.exec(periodKey);
  if (y) return `Năm ${y[1]}`;
  return periodKey;
}

export function getPeriodRange(filter: SummaryFilter): {
  periodKey: string;
  periodLabel: string;
  fromDate: string;
  toDate: string;
} {
  const { periodType, year, month, quarter } = filter;
  if (periodType === "month") {
    const safeMonth = Math.min(12, Math.max(1, month));
    const endDay = lastDayOfMonth(year, safeMonth);
    return {
      periodKey: `month:${year}-${pad2(safeMonth)}`,
      periodLabel: `Tháng ${pad2(safeMonth)}/${year}`,
      fromDate: `${year}-${pad2(safeMonth)}-01`,
      toDate: `${year}-${pad2(safeMonth)}-${pad2(endDay)}`,
    };
  }
  if (periodType === "quarter") {
    const safeQuarter = Math.min(4, Math.max(1, quarter));
    const startMonth = (safeQuarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = lastDayOfMonth(year, endMonth);
    const roman = ["I", "II", "III", "IV"][safeQuarter - 1];
    return {
      periodKey: `quarter:${year}-Q${safeQuarter}`,
      periodLabel: `Quý ${roman}/${year}`,
      fromDate: `${year}-${pad2(startMonth)}-01`,
      toDate: `${year}-${pad2(endMonth)}-${pad2(endDay)}`,
    };
  }
  return {
    periodKey: `year:${year}`,
    periodLabel: `Năm ${year}`,
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
  };
}

export function parseSummaryFilter(
  raw: { periodType?: string; year?: string | number; month?: string | number; quarter?: string | number },
  today: string,
): SummaryFilter {
  const currentYear = Number(today.slice(0, 4)) || 2026;
  const currentMonth = Number(today.slice(5, 7)) || 1;
  const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;

  const periodType: SummaryPeriodType =
    raw.periodType === "month" || raw.periodType === "quarter" || raw.periodType === "year"
      ? raw.periodType
      : "month";

  const parsedYear = Number(raw.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : currentYear;

  const parsedMonth = Number(raw.month);
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : currentMonth;

  const parsedQuarter = Number(raw.quarter);
  const quarter =
    Number.isInteger(parsedQuarter) && parsedQuarter >= 1 && parsedQuarter <= 4 ? parsedQuarter : currentQuarter;

  return { periodType, year, month, quarter };
}

export function normalizeStoredOpeningBalances(raw: unknown): StoredOpeningBalances {
  if (!raw || typeof raw !== "object") return { periods: {} };
  const obj = raw as Record<string, unknown>;
  const rawPeriods = obj.periods && typeof obj.periods === "object" ? (obj.periods as Record<string, unknown>) : {};
  const periods: Record<string, PeriodOpeningEntry> = {};

  for (const [key, val] of Object.entries(rawPeriods)) {
    if (!val || typeof val !== "object") continue;
    const item = val as Record<string, unknown>;
    const periodKey = typeof item.periodKey === "string" ? item.periodKey.trim() : key;
    const fromDate = typeof item.fromDate === "string" ? item.fromDate.trim() : "";
    const amount = Math.round(Number(item.amount ?? 0));
    const note = typeof item.note === "string" && item.note.trim() ? item.note.trim() : null;
    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString();
    if (!periodKey || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !Number.isFinite(amount)) continue;
    periods[periodKey] = { periodKey, fromDate, amount, note, updatedAt };
  }

  return { periods };
}

function periodKeyPriority(periodKey: string): number {
  if (periodKey.startsWith("month:")) return 3;
  if (periodKey.startsWith("quarter:")) return 2;
  return 1;
}

/**
 * Tính số dư đầu kỳ cho kỳ đang chọn:
 * 1. Nếu kỳ này đã nhập trực tiếp số dư đầu kỳ kết chuyển -> lấy đúng số đã nhập.
 * 2. Nếu có kỳ trước (fromDate <= kỳ đang chọn) đã nhập số dư đầu kỳ -> lấy số dư kỳ đó + chênh lệch thu chi phát sinh từ đầu kỳ đó đến trước kỳ đang chọn.
 * 3. Nếu chưa nhập -> lấy tổng số dư đầu kỳ của các quỹ + chênh lệch thu chi phát sinh trước ngày bắt đầu kỳ.
 */
export function resolveOpeningBalance(
  periodKey: string,
  fromDate: string,
  funds: Fund[],
  entries: FundEntry[],
  openingBalances: StoredOpeningBalances,
): {
  amount: number;
  source: OpeningBalanceSource;
  note: string | null;
  checkpointLabel: string | null;
} {
  const direct = openingBalances.periods[periodKey];
  if (direct) {
    return {
      amount: direct.amount,
      source: "manual",
      note: direct.note,
      checkpointLabel: formatPeriodKeyLabel(direct.periodKey),
    };
  }

  const candidates = Object.values(openingBalances.periods)
    .filter((p) => p.fromDate <= fromDate)
    .sort((a, b) => {
      const cmp = b.fromDate.localeCompare(a.fromDate);
      if (cmp !== 0) return cmp;
      return periodKeyPriority(b.periodKey) - periodKeyPriority(a.periodKey);
    });

  if (candidates.length > 0) {
    const checkpoint = candidates[0];
    let netBefore = 0;
    for (const e of entries) {
      if (e.status !== "posted") continue;
      if (e.entry_date >= checkpoint.fromDate && e.entry_date < fromDate) {
        netBefore += entryEffect(e, null);
      }
    }
    return {
      amount: checkpoint.amount + netBefore,
      source: "carried",
      note: checkpoint.note,
      checkpointLabel: formatPeriodKeyLabel(checkpoint.periodKey),
    };
  }

  let base = funds.reduce((sum, f) => sum + f.opening_balance, 0);
  for (const e of entries) {
    if (e.status !== "posted") continue;
    if (e.entry_date < fromDate) {
      base += entryEffect(e, null);
    }
  }
  return {
    amount: base,
    source: "funds",
    note: null,
    checkpointLabel: null,
  };
}

export function computeFinanceSummary(params: {
  filter: SummaryFilter;
  funds: Fund[];
  categories: FundCategory[];
  entries: FundEntry[];
  entryNotes: Record<string, string>;
  openingBalances: StoredOpeningBalances;
  includeZeroCategories?: boolean;
}): ComputedFinanceSummary {
  const {
    filter,
    funds,
    categories,
    entries,
    entryNotes,
    openingBalances,
    includeZeroCategories = true,
  } = params;
  const { periodKey, periodLabel, fromDate, toDate } = getPeriodRange(filter);

  const opening = resolveOpeningBalance(periodKey, fromDate, funds, entries, openingBalances);

  const fundById = new Map(funds.map((f) => [f.id, f]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const incomeMap = new Map<string, CategorySummaryRow>();
  const expenseMap = new Map<string, CategorySummaryRow>();

  for (const c of categories) {
    const row: CategorySummaryRow = {
      categoryId: c.id,
      code: c.code,
      name: c.name,
      kind: c.kind,
      isActive: c.is_active,
      entryCount: 0,
      totalAmount: 0,
      percentage: 0,
      sampleNote: null,
    };
    if (c.kind === "income") incomeMap.set(c.id, row);
    else expenseMap.set(c.id, row);
  }

  const sorted = [...entries].sort(compareEntries);
  const detailRows: SummaryDetailRow[] = [];
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeEntryCount = 0;
  let expenseEntryCount = 0;

  for (const e of sorted) {
    if (e.status !== "posted") continue;
    if (e.kind !== "income" && e.kind !== "expense") continue;
    if (e.entry_date < fromDate || e.entry_date > toDate) continue;

    const cat = e.category_id ? categoryById.get(e.category_id) : undefined;
    const targetMap = e.kind === "income" ? incomeMap : expenseMap;
    const catKey = cat?.id ?? `__unclassified_${e.kind}`;
    let summaryRow = targetMap.get(catKey);
    if (!summaryRow) {
      summaryRow = {
        categoryId: catKey,
        code: cat?.code ?? null,
        name: cat?.name ?? (e.kind === "income" ? "Thu khác (chưa phân loại)" : "Chi khác (chưa phân loại)"),
        kind: e.kind,
        isActive: true,
        entryCount: 0,
        totalAmount: 0,
        percentage: 0,
        sampleNote: null,
      };
      targetMap.set(catKey, summaryRow);
    }

    const logNote = entryNotes[e.id] ?? null;
    const displayNote =
      [logNote, e.counterparty, e.document_no ? `CT: ${e.document_no}` : null].filter(Boolean).join(" · ") || null;

    summaryRow.entryCount += 1;
    summaryRow.totalAmount += e.amount;
    if (!summaryRow.sampleNote) {
      summaryRow.sampleNote = e.description;
    }

    if (e.kind === "income") {
      totalIncome += e.amount;
      incomeEntryCount += 1;
    } else {
      totalExpense += e.amount;
      expenseEntryCount += 1;
    }

    detailRows.push({
      id: e.id,
      code: e.code,
      entryDate: e.entry_date,
      kind: e.kind,
      categoryId: e.category_id,
      categoryCode: cat?.code ?? null,
      categoryName: summaryRow.name,
      fundName: fundById.get(e.fund_id)?.name ?? "Quỹ công đoàn",
      description: e.description,
      amount: e.amount,
      note: displayNote,
    });
  }

  const finalizeRows = (map: Map<string, CategorySummaryRow>, grandTotal: number): CategorySummaryRow[] => {
    const list = [...map.values()].filter(
      (r) => r.totalAmount > 0 || (includeZeroCategories && r.isActive),
    );
    for (const r of list) {
      r.percentage = grandTotal > 0 ? Math.round((r.totalAmount / grandTotal) * 1000) / 10 : 0;
    }
    return list;
  };

  const incomeRows = finalizeRows(incomeMap, totalIncome);
  const expenseRows = finalizeRows(expenseMap, totalExpense);
  const netAmount = totalIncome - totalExpense;
  const closingBalance = opening.amount + netAmount;

  return {
    periodKey,
    periodLabel,
    fromDate,
    toDate,
    openingBalance: opening.amount,
    openingSource: opening.source,
    openingNote: opening.note,
    openingCheckpointLabel: opening.checkpointLabel,
    totalIncome,
    totalExpense,
    netAmount,
    closingBalance,
    incomeRows,
    expenseRows,
    incomeEntryCount,
    expenseEntryCount,
    detailRows,
  };
}

export function collectAvailableYears(entries: FundEntry[], openingBalances: StoredOpeningBalances, today: string): number[] {
  const currentYear = Number(today.slice(0, 4)) || 2026;
  const years = new Set<number>([currentYear, currentYear - 1]);
  for (const e of entries) {
    const y = Number(e.entry_date.slice(0, 4));
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  for (const p of Object.values(openingBalances.periods)) {
    const y = Number(p.fromDate.slice(0, 4));
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
