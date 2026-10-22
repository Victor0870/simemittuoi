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
};

export type FundCategory = {
  id: string;
  kind: CategoryKind;
  code: string | null;
  name: string;
  system_key: string | null;
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
