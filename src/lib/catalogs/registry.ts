/**
 * Danh mục đối tượng (công ty, cá nhân nhận / nộp tiền): kiểu dữ liệu, nhãn, kiểm tra form
 * (dùng ở cả trình duyệt và API).
 */

export type CounterpartyKind = "organization" | "individual";

export const COUNTERPARTY_KIND_LABEL: Record<CounterpartyKind, string> = {
  organization: "Tổ chức / Công ty",
  individual: "Cá nhân",
};

export const COUNTERPARTY_LIMITS = {
  code: 20,
  name: 200,
  address: 300,
  taxCode: 20,
  account: 40,
  bankName: 120,
} as const;

export type Counterparty = {
  id: string;
  code: string;
  kind: CounterpartyKind;
  name: string;
  address: string | null;
  tax_code: string | null;
  bank_account_no: string | null;
  bank_name: string | null;
  is_active: boolean;
};

export type CounterpartyInput = {
  code: string | null;
  kind: CounterpartyKind;
  name: string;
  address: string | null;
  taxCode: string | null;
  bankAccountNo: string | null;
  bankName: string | null;
  isActive: boolean;
};

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function parseCounterpartyInput(
  raw: Record<string, unknown>,
): { ok: true; value: CounterpartyInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const kind: CounterpartyKind = raw.kind === "individual" ? "individual" : "organization";

  const code = oneLine(raw.code).toUpperCase().replace(/\s/g, "") || null;
  if (code && !/^[A-Z0-9._-]+$/.test(code)) errors.push("Mã số đối tượng chỉ gồm chữ không dấu, số và . _ -");
  if ((code?.length ?? 0) > COUNTERPARTY_LIMITS.code) errors.push(`Mã số tối đa ${COUNTERPARTY_LIMITS.code} ký tự.`);

  const name = oneLine(raw.name);
  if (!name) errors.push("Vui lòng nhập tên đối tượng.");
  if (name.length > COUNTERPARTY_LIMITS.name) errors.push(`Tên tối đa ${COUNTERPARTY_LIMITS.name} ký tự.`);

  const address = oneLine(raw.address) || null;
  if ((address?.length ?? 0) > COUNTERPARTY_LIMITS.address) errors.push(`Địa chỉ tối đa ${COUNTERPARTY_LIMITS.address} ký tự.`);

  const taxCode = oneLine(raw.taxCode).replace(/\s/g, "") || null;
  if (taxCode && !/^\d{10}(-?\d{3})?$/.test(taxCode)) {
    errors.push("Mã số thuế gồm 10 chữ số, hoặc 10 chữ số + mã chi nhánh 3 số (VD 0101234567-001).");
  }

  const bankAccountNo = oneLine(raw.bankAccountNo).replace(/\s/g, "") || null;
  if ((bankAccountNo?.length ?? 0) > COUNTERPARTY_LIMITS.account) errors.push("Số tài khoản quá dài.");
  const bankName = oneLine(raw.bankName) || null;
  if ((bankName?.length ?? 0) > COUNTERPARTY_LIMITS.bankName) errors.push("Tên ngân hàng quá dài.");
  if (Boolean(bankAccountNo) !== Boolean(bankName)) errors.push("Nhập đủ cả số tài khoản và ngân hàng (hoặc để trống cả hai).");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { code, kind, name, address, taxCode, bankAccountNo, bankName, isActive: raw.isActive !== false },
  };
}

/** Bỏ dấu + chữ thường để tìm kiếm không phân biệt dấu. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function counterpartyMatches(c: Counterparty, query: string): boolean {
  const q = foldText(query.trim());
  if (!q) return true;
  return foldText([c.code, c.name, c.tax_code, c.bank_account_no, c.address].filter(Boolean).join(" ")).includes(q);
}
