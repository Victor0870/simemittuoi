/**
 * Sổ quỹ công đoàn: kiểu dữ liệu, nhãn, kiểm tra form và tính số dư (dùng ở cả trình duyệt và API).
 */

export type FundKind = "cash" | "bank" | "savings";
export type EntryKind = "income" | "expense" | "transfer";
export type CategoryKind = "income" | "expense";

export const FUND_KIND_LABEL: Record<FundKind, string> = {
  cash: "Tiền mặt",
  bank: "Tài khoản thanh toán",
  savings: "Tiền gửi tiết kiệm",
};

export const FUND_KIND_ICON: Record<FundKind, string> = {
  cash: "payments",
  bank: "account_balance",
  savings: "savings",
};

/** Tiền mặt và tài khoản thanh toán chi được ngay; tiền gửi tiết kiệm phải chuyển quỹ về trước. */
export function isSpendableFund(fund: Pick<Fund, "kind">): boolean {
  return fund.kind !== "savings";
}

/** Dòng phụ mô tả quỹ: số TK / số sổ, ngân hàng, lãi suất, đáo hạn. */
export function fundSubtitle(fund: Fund, formatDate: (iso: string) => string): string {
  if (fund.kind === "cash") return FUND_KIND_LABEL.cash;
  const parts = [
    fund.bank_account_no && (fund.kind === "savings" ? `Sổ ${fund.bank_account_no}` : `TK ${fund.bank_account_no}`),
    fund.bank_name,
    fund.kind === "savings" && fund.interest_rate !== null ? `${fund.interest_rate}%/năm` : null,
    fund.kind === "savings" && fund.maturity_date ? `đáo hạn ${formatDate(fund.maturity_date)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : FUND_KIND_LABEL[fund.kind];
}

/** Hiện nhãn "Sắp đáo hạn" từ trước ngày đáo hạn bao nhiêu ngày. Thông báo nhắc gửi trước 7 ngày (hàm cdilv_notify_savings_maturity). */
export const SAVINGS_SOON_DAYS = 30;

export type SavingsMaturityStatus = { tone: "soon" | "due" | "overdue"; label: string; days: number };

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Trạng thái đáo hạn của sổ tiết kiệm đang dùng; null nếu chưa tới lúc nhắc hoặc không phải sổ tiết kiệm. */
export function savingsMaturityStatus(fund: Fund, today: string): SavingsMaturityStatus | null {
  if (fund.kind !== "savings" || !fund.is_active || !fund.maturity_date) return null;
  const days = daysBetween(today, fund.maturity_date);
  if (days > SAVINGS_SOON_DAYS) return null;
  if (days < 0) return { tone: "overdue", label: `Quá hạn ${-days} ngày`, days };
  if (days === 0) return { tone: "due", label: "Đến hạn hôm nay", days };
  return { tone: "soon", label: `Sắp đáo hạn (còn ${days} ngày)`, days };
}

/** Số sổ tiết kiệm còn tiền, đến hạn / quá hạn hoặc sẽ đáo hạn trong withinDays ngày (cùng cửa sổ với thông báo nhắc). */
export function countSavingsNeedingAction(funds: Fund[], entries: FundEntry[], today: string, withinDays = 7): number {
  return funds.filter((f) => {
    const status = savingsMaturityStatus(f, today);
    return status !== null && status.days <= withinDays && fundBalance(f, entries) > 0;
  }).length;
}

export const SAVINGS_STATUS_CLASS: Record<SavingsMaturityStatus["tone"], string> = {
  soon: "bg-amber-100 text-amber-900",
  due: "bg-rose-100 text-rose-800",
  overdue: "bg-rose-600 text-white",
};

export type SavingsMaturityAction = "settle" | "renew";

export type SavingsMaturityInput = {
  action: SavingsMaturityAction;
  entryDate: string;
  interestAmount: number;
  /** Tất toán: quỹ nhận gốc + lãi (bắt buộc). Tái tục: quỹ nhận lãi, null = lãi nhập gốc vào sổ. */
  targetFundId: string | null;
  newMaturityDate: string | null;
  newInterestRate: number | null;
  documentNo: string | null;
};

export function parseSavingsMaturityInput(
  raw: Record<string, unknown>,
): { ok: true; value: SavingsMaturityInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const action = raw.action;
  if (action !== "settle" && action !== "renew") return { ok: false, errors: ["Vui lòng chọn Tất toán hoặc Tái tục."] };

  const entryDate = oneLine(raw.entryDate);
  if (!isValidDate(entryDate)) errors.push("Ngày ghi sổ không hợp lệ.");

  const interestAmount = Math.round(Number(raw.interestAmount ?? 0));
  if (!Number.isFinite(interestAmount) || interestAmount < 0) errors.push("Tiền lãi không hợp lệ.");
  else if (interestAmount > FINANCE_LIMITS.maxAmount) errors.push("Tiền lãi quá lớn.");

  const targetFundId = uuidOrNull(raw.targetFundId);
  if (action === "settle" && !targetFundId) errors.push("Vui lòng chọn quỹ nhận tiền tất toán.");

  let newMaturityDate: string | null = null;
  let newInterestRate: number | null = null;
  if (action === "renew") {
    newMaturityDate = oneLine(raw.newMaturityDate);
    if (!isValidDate(newMaturityDate)) errors.push("Vui lòng nhập ngày đáo hạn mới.");
    else if (isValidDate(entryDate) && newMaturityDate <= entryDate) errors.push("Ngày đáo hạn mới phải sau ngày ghi sổ.");
    const rateText = oneLine(raw.newInterestRate).replace(",", ".");
    if (rateText) {
      newInterestRate = Math.round(Number(rateText) * 100) / 100;
      if (!Number.isFinite(newInterestRate) || newInterestRate < 0 || newInterestRate > 100) errors.push("Lãi suất không hợp lệ.");
    }
  }

  const documentNo = oneLine(raw.documentNo) || null;
  if ((documentNo?.length ?? 0) > FINANCE_LIMITS.documentNo) errors.push("Số chứng từ quá dài.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { action, entryDate, interestAmount, targetFundId, newMaturityDate, newInterestRate, documentNo },
  };
}

/** Tham số p_data cho RPC cdilv_savings_mature. */
export function savingsMaturityRpcData(input: SavingsMaturityInput) {
  return {
    action: input.action,
    entry_date: input.entryDate,
    interest_amount: input.interestAmount,
    target_fund_id: input.action === "settle" ? input.targetFundId : null,
    interest_fund_id: input.action === "renew" ? input.targetFundId : null,
    new_maturity_date: input.newMaturityDate,
    new_interest_rate: input.newInterestRate,
    document_no: input.documentNo,
  };
}

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  income: "Phiếu thu",
  expense: "Phiếu chi",
  transfer: "Chuyển quỹ",
};

export const ENTRY_LOG_LABEL: Record<string, string> = {
  created: "Ghi sổ",
  edited: "Sửa bút toán",
  voided: "Hủy bút toán",
};

export const FINANCE_LIMITS = {
  description: 300,
  name: 120,
  categoryName: 160,
  categoryCode: 20,
  account: 40,
  documentNo: 60,
  reason: 500,
  maxAmount: 100_000_000_000,
} as const;

export type InterestRateType = "fixed" | "floating";
export const INTEREST_RATE_TYPE_LABEL: Record<InterestRateType, string> = {
  fixed: "Lãi suất cố định",
  floating: "Lãi suất thả nổi",
};

export type InterestPeriod = "monthly" | "end_of_term" | "quarterly" | "yearly";
export const INTEREST_PERIOD_LABEL: Record<InterestPeriod, string> = {
  monthly: "Lĩnh lãi hàng tháng",
  end_of_term: "Lĩnh lãi cuối kỳ",
  quarterly: "Lĩnh lãi hàng quý",
  yearly: "Lĩnh lãi hàng năm",
};

export type SavingsMonthlyRate = {
  id: string;
  fund_id: string;
  period_month: string;
  interest_rate: number;
  principal_amount: number;
  interest_amount: number;
  days_in_month?: number | null;
  calculation_formula?: string | null;
  is_collected: boolean;
  collected_entry_id?: string | null;
  collected_at?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Fund = {
  id: string;
  kind: FundKind;
  name: string;
  bank_account_no: string | null;
  bank_name: string | null;
  interest_rate: number | null;
  maturity_date: string | null;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
  sort_order: number;
  interest_rate_type?: InterestRateType | null;
  term_months?: number | null;
  interest_period?: InterestPeriod | null;
  deposit_date?: string | null;
  notes?: string | null;
};

export type FundCategory = {
  id: string;
  kind: CategoryKind;
  code: string | null;
  name: string;
  system_key: string | null;
  /** Mã chỉ tiêu (VD 22, 25.01) của mẫu báo cáo đang áp dụng – phân loại theo báo cáo tổng hợp. */
  report_group: string | null;
  sort_order: number;
  is_active: boolean;
};

export type FundEntry = {
  id: string;
  code: string;
  entry_date: string;
  kind: EntryKind;
  fund_id: string;
  to_fund_id: string | null;
  category_id: string | null;
  amount: number;
  description: string;
  counterparty: string | null;
  document_no: string | null;
  payment_request_id: string | null;
  status: "posted" | "void";
  void_reason: string | null;
  created_at: string;
};

/** Ảnh hưởng của một bút toán tới số dư một quỹ (fundId null = gộp mọi quỹ, chuyển quỹ không làm đổi). */
export function entryEffect(entry: FundEntry, fundId: string | null): number {
  if (entry.status !== "posted") return 0;
  if (entry.kind === "income") return fundId === null || entry.fund_id === fundId ? entry.amount : 0;
  if (entry.kind === "expense") return fundId === null || entry.fund_id === fundId ? -entry.amount : 0;
  if (fundId === null) return 0;
  if (entry.fund_id === fundId) return -entry.amount;
  if (entry.to_fund_id === fundId) return entry.amount;
  return 0;
}

export function entryTouchesFund(entry: FundEntry, fundId: string | null): boolean {
  return fundId === null || entry.fund_id === fundId || entry.to_fund_id === fundId;
}

/** Sắp xếp sổ: theo ngày, rồi theo thời điểm ghi. */
export function compareEntries(a: FundEntry, b: FundEntry): number {
  return a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at);
}

export function fundBalance(fund: Fund, entries: FundEntry[], untilDate?: string): number {
  let balance = fund.opening_balance;
  for (const e of entries) {
    if (untilDate && e.entry_date > untilDate) continue;
    balance += entryEffect(e, fund.id);
  }
  return balance;
}

export type EntryInput = {
  entryDate: string;
  kind: EntryKind;
  fundId: string;
  toFundId: string | null;
  categoryId: string | null;
  amount: number;
  description: string;
  counterparty: string | null;
  documentNo: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function parseEntryInput(
  raw: Record<string, unknown>,
): { ok: true; value: EntryInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const kind = raw.kind;
  if (kind !== "income" && kind !== "expense" && kind !== "transfer") {
    return { ok: false, errors: ["Loại bút toán không hợp lệ."] };
  }

  const entryDate = oneLine(raw.entryDate);
  if (!isValidDate(entryDate)) errors.push("Ngày ghi sổ không hợp lệ.");

  const fundId = uuidOrNull(raw.fundId);
  if (!fundId) errors.push(kind === "transfer" ? "Vui lòng chọn quỹ chuyển đi." : "Vui lòng chọn quỹ.");
  const toFundId = kind === "transfer" ? uuidOrNull(raw.toFundId) : null;
  if (kind === "transfer") {
    if (!toFundId) errors.push("Vui lòng chọn quỹ nhận.");
    else if (toFundId === fundId) errors.push("Quỹ chuyển đi và quỹ nhận phải khác nhau.");
  }
  const categoryId = kind === "transfer" ? null : uuidOrNull(raw.categoryId);
  if (kind !== "transfer" && !categoryId) errors.push("Vui lòng chọn danh mục thu / chi.");

  const amount = Math.round(Number(raw.amount));
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Vui lòng nhập số tiền.");
  else if (amount > FINANCE_LIMITS.maxAmount) errors.push("Số tiền quá lớn.");

  const description = oneLine(raw.description);
  if (!description) errors.push("Vui lòng nhập diễn giải.");
  if (description.length > FINANCE_LIMITS.description) errors.push(`Diễn giải tối đa ${FINANCE_LIMITS.description} ký tự.`);

  const counterparty = oneLine(raw.counterparty) || null;
  if ((counterparty?.length ?? 0) > FINANCE_LIMITS.name) errors.push("Tên người nộp / người nhận quá dài.");
  const documentNo = oneLine(raw.documentNo) || null;
  if ((documentNo?.length ?? 0) > FINANCE_LIMITS.documentNo) errors.push("Số chứng từ quá dài.");

  if (errors.length || !fundId) return { ok: false, errors };
  return {
    ok: true,
    value: { entryDate, kind, fundId, toFundId, categoryId, amount, description, counterparty, documentNo },
  };
}

/** Tham số p_data cho RPC cdilv_fund_entry_save. */
export function entryRpcData(input: EntryInput) {
  return {
    entry_date: input.entryDate,
    kind: input.kind,
    fund_id: input.fundId,
    to_fund_id: input.toFundId,
    category_id: input.categoryId,
    amount: input.amount,
    description: input.description,
    counterparty: input.counterparty,
    document_no: input.documentNo,
  };
}

export function formatVndPlain(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

/** Ngày cuối tháng trước của một ngày YYYY-MM-DD. */
export function endOfPreviousMonth(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 0));
  return d.toISOString().slice(0, 10);
}

/** Tính tiền lãi tháng: Gốc * (Lãi suất %/năm) / 100 / 12 */
export function calculateMonthlyInterest(principal: number, annualRatePercent: number): number {
  if (principal <= 0 || annualRatePercent <= 0) return 0;
  return Math.round((principal * annualRatePercent) / 100 / 12);
}

/** Tính tiền lãi theo số ngày thực tế trong tháng: Gốc * (Lãi suất %/năm / 100) * days / 365 */
export function calculateDailyInterest(principal: number, annualRatePercent: number, daysInMonth: number): number {
  if (principal <= 0 || annualRatePercent <= 0 || daysInMonth <= 0) return 0;
  return Math.round((principal * (annualRatePercent / 100) * daysInMonth) / 365);
}

/** Số ngày trong tháng của kỳ YYYY-MM */
export function daysInPeriodMonth(periodMonth: string): number {
  const [y, m] = periodMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Định dạng chu kỳ tháng YYYY-MM sang Tiếng Việt "Tháng MM/YYYY" */
export function formatPeriodMonthVi(periodMonth: string): string {
  const [y, m] = periodMonth.split("-");
  return `Tháng ${m}/${y}`;
}

/** Lấy tháng trước của một ngày YYYY-MM-DD dạng "YYYY-MM" */
export function getPreviousPeriodMonth(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevYear = prevDate.getUTCFullYear();
  const prevMonth = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}`;
}
