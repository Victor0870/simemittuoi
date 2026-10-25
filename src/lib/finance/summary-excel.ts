import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentAccess, type CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  FINANCE_LIMITS,
  entryRpcData,
  isValidDate,
  type CategoryKind,
  type FundCategory,
} from "@/lib/finance/registry";
import { loadCategories, loadFunds, loadLockedThrough } from "@/lib/finance/server";
import { formatDateVi } from "@/lib/members/profile-shared";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";
import type { ComputedFinanceSummary } from "./summary";

export const FINANCE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const FINANCE_IMPORT_MAX_ROWS = 1000;

export const FINANCE_INCOME_TEMPLATE_HEADERS = [
  "Ngày",
  "Danh mục thu",
  "Nội dung thu",
  "Số tiền thu",
  "Ghi chú",
] as const;

export const FINANCE_EXPENSE_TEMPLATE_HEADERS = [
  "Ngày",
  "Danh mục chi",
  "Nội dung chi",
  "Số tiền chi",
  "Ghi chú",
] as const;

export function getFinanceTemplateHeaders(kind: CategoryKind): readonly string[] {
  return kind === "income" ? FINANCE_INCOME_TEMPLATE_HEADERS : FINANCE_EXPENSE_TEMPLATE_HEADERS;
}

export function parseSummaryKind(raw: unknown, fallback: CategoryKind = "income"): CategoryKind {
  if (raw === "income" || raw === "expense") return raw;
  return fallback;
}

export type FinanceImportPreviewRow = {
  row: number;
  entryDate: string | null;
  entryDateDisplay: string;
  kind: CategoryKind;
  kindLabel: string;
  categoryId: string | null;
  categoryName: string;
  content: string;
  amount: number | null;
  note: string | null;
  errors: string[];
};

export type FinanceImportPreviewResult = {
  kind: CategoryKind;
  rows: FinanceImportPreviewRow[];
  columns: string[];
};

export type FinanceImportCommitError = {
  row: number;
  message: string;
};

export type FinanceImportCommitResult = {
  imported: number;
  skipped: number;
  errors: FinanceImportCommitError[];
};

/** Kiểm tra quyền ghi/nhập tài chính trên máy chủ (finance.record hoặc finance.manage). */
export async function requireFinanceWriteAccess(): Promise<CurrentAccess | NextResponse> {
  const access = await getCurrentAccess();
  if (!access) {
    return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
  }
  if (!hasPermission(access, PERMISSIONS.financeRecord) && !hasPermission(access, PERMISSIONS.financeManage)) {
    return NextResponse.json(
      { error: "Bạn chưa được phân quyền nhập / ghi sổ thu chi công đoàn." },
      { status: 403 },
    );
  }
  return access;
}

/** Kiểm tra quyền xem tài chính trên máy chủ (finance.view, finance.record hoặc finance.manage). */
export async function requireFinanceViewAccess(): Promise<CurrentAccess | NextResponse> {
  const access = await getCurrentAccess();
  if (!access) {
    return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
  }
  if (
    !hasPermission(access, PERMISSIONS.financeView) &&
    !hasPermission(access, PERMISSIONS.financeRecord) &&
    !hasPermission(access, PERMISSIONS.financeManage)
  ) {
    return NextResponse.json(
      { error: "Bạn chưa được phân quyền xem tài chính công đoàn." },
      { status: 403 },
    );
  }
  return access;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function plainCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if ("result" in obj) return plainCellValue(obj.result as ExcelJS.CellValue);
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text?: string }[]).map((t) => t.text ?? "").join("");
    }
    if (typeof obj.text === "string") return obj.text;
    return null;
  }
  return value;
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function toIsoDate(y: number, m: number, d: number): string | null {
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseExcelDate(raw: unknown): string | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toIsoDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1 || raw > 2958465) return null;
    const date = new Date(Math.round((raw - 25569) * 86400000));
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const vn = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (vn) return toIsoDate(Number(vn[3]), Number(vn[2]), Number(vn[1]));
  const iso = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(text);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function parseKindValue(raw: unknown): CategoryKind | null {
  if (typeof raw !== "string") return null;
  const f = fold(raw);
  if (["thu", "phieu thu", "income", "t", "khoan thu"].includes(f)) return "income";
  if (["chi", "phieu chi", "expense", "c", "khoan chi"].includes(f)) return "expense";
  return null;
}

function parseAmountValue(raw: unknown): number | null {
  if (typeof raw === "number") {
    const rounded = Math.round(raw);
    return Number.isFinite(rounded) ? rounded : null;
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d-]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function matchCategory(
  rawCategory: string,
  expectedKind: CategoryKind,
  categories: FundCategory[],
): { matched: FundCategory | null; error: string | null } {
  const kindLabel = expectedKind === "income" ? "thu" : "chi";
  const trimmed = rawCategory.trim();
  if (!trimmed) {
    return { matched: null, error: `Thiếu danh mục ${kindLabel}.` };
  }
  const f = fold(trimmed);
  const activeCategories = categories.filter((c) => c.is_active);
  const candidates = activeCategories.filter(
    (c) =>
      fold(c.name) === f ||
      (c.code && fold(c.code) === f) ||
      (c.code && fold(`${c.code} - ${c.name}`) === f) ||
      (c.code && fold(`${c.code} ${c.name}`) === f),
  );

  if (candidates.length === 0) {
    const partial = activeCategories.filter(
      (c) => c.kind === expectedKind && (fold(c.name).includes(f) || f.includes(fold(c.name))),
    );
    if (partial.length === 1) {
      return { matched: partial[0], error: null };
    }
    return {
      matched: null,
      error: `Danh mục ${kindLabel} “${trimmed}” không tồn tại trong hệ thống (vui lòng chọn đúng tên ở trang Danh mục & Hướng dẫn).`,
    };
  }

  const sameKind = candidates.find((c) => c.kind === expectedKind);
  if (!sameKind) {
    const wrongKind = candidates[0];
    return {
      matched: null,
      error: `Danh mục “${wrongKind.name}” thuộc nhóm ${wrongKind.kind === "income" ? "Thu" : "Chi"}, không phải danh mục ${expectedKind === "income" ? "Thu" : "Chi"}.`,
    };
  }
  return { matched: sameKind, error: null };
}

type HeaderMapping = {
  headerRow: number;
  dateCol: number;
  kindCol: number;
  categoryCol: number;
  contentCol: number;
  amountCol: number;
  noteCol: number;
};

function detectHeaders(ws: ExcelJS.Worksheet): HeaderMapping | null {
  for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
    let dateCol = 0;
    let kindCol = 0;
    let categoryCol = 0;
    let contentCol = 0;
    let amountCol = 0;
    let noteCol = 0;

    ws.getRow(r).eachCell((cell, col) => {
      const val = plainCellValue(cell.value);
      if (typeof val !== "string") return;
      const f = fold(val);
      if (!dateCol && ["ngay", "ngay ghi so", "ngay phat sinh", "ngay thu", "ngay chi", "date"].includes(f))
        dateCol = col;
      else if (!kindCol && ["loai thu/chi", "loai", "loai phieu", "thu/chi", "thu / chi", "type"].includes(f))
        kindCol = col;
      else if (
        !categoryCol &&
        [
          "danh muc",
          "danh muc thu",
          "danh muc chi",
          "danh muc thu chi",
          "danh muc thu/chi",
          "category",
        ].includes(f)
      )
        categoryCol = col;
      else if (
        !contentCol &&
        [
          "noi dung",
          "noi dung thu",
          "noi dung chi",
          "dien giai",
          "noi dung thu chi",
          "content",
          "description",
        ].includes(f)
      )
        contentCol = col;
      else if (
        !amountCol &&
        [
          "so tien",
          "so tien thu",
          "so tien chi",
          "so tien (vnd)",
          "so tien vnd",
          "thanh tien",
          "amount",
        ].includes(f)
      )
        amountCol = col;
      else if (!noteCol && ["ghi chu", "chu thich", "note", "notes"].includes(f)) noteCol = col;
    });

    if (dateCol && categoryCol && contentCol && amountCol) {
      return { headerRow: r, dateCol, kindCol, categoryCol, contentCol, amountCol, noteCol };
    }
  }
  return null;
}

function validateImportRow(params: {
  row: number;
  expectedKind: CategoryKind;
  dateRaw: unknown;
  kindRaw: unknown;
  categoryRaw: unknown;
  contentRaw: unknown;
  amountRaw: unknown;
  noteRaw: unknown;
  categories: FundCategory[];
  lockedThrough: string | null;
}): FinanceImportPreviewRow {
  const errors: string[] = [];
  const isIncome = params.expectedKind === "income";
  const kindNoun = isIncome ? "thu" : "chi";
  const kindTitle = isIncome ? "Thu" : "Chi";

  const entryDate = parseExcelDate(params.dateRaw);
  const entryDateDisplay = entryDate
    ? formatDateVi(entryDate)
    : isBlank(params.dateRaw)
      ? "—"
      : String(params.dateRaw).trim();
  if (!entryDate) {
    errors.push("Ngày không hợp lệ (nhập dạng dd/mm/yyyy hoặc yyyy-mm-dd).");
  } else if (params.lockedThrough && entryDate <= params.lockedThrough) {
    errors.push(`Ngày ${formatDateVi(entryDate)} thuộc kỳ đã khóa sổ (đến hết ${formatDateVi(params.lockedThrough)}).`);
  }

  if (!isBlank(params.kindRaw)) {
    const parsedKind = parseKindValue(params.kindRaw);
    if (!parsedKind) {
      errors.push(`Loại phiếu “${String(params.kindRaw).trim()}” không hợp lệ (chỉ nhận “${kindTitle}”).`);
    } else if (parsedKind !== params.expectedKind) {
      errors.push(
        `Trang Tổng hợp ${kindNoun} chỉ nhận các khoản ${kindTitle} (dòng này đang ghi “${parsedKind === "income" ? "Thu" : "Chi"}”).`,
      );
    }
  }

  const categoryText = isBlank(params.categoryRaw) ? "" : String(params.categoryRaw).trim();
  const catMatch = matchCategory(categoryText, params.expectedKind, params.categories);
  if (catMatch.error) {
    errors.push(catMatch.error);
  }

  const content = isBlank(params.contentRaw) ? "" : String(params.contentRaw).trim().replace(/\s+/g, " ");
  if (!content) {
    errors.push(`Thiếu nội dung khoản ${kindNoun}.`);
  } else if (content.length > FINANCE_LIMITS.description) {
    errors.push(`Nội dung tối đa ${FINANCE_LIMITS.description} ký tự.`);
  }

  const amount = parseAmountValue(params.amountRaw);
  if (amount === null || amount <= 0) {
    errors.push(`Số tiền ${kindNoun} phải là số nguyên dương lớn hơn 0.`);
  } else if (amount > FINANCE_LIMITS.maxAmount) {
    errors.push("Số tiền vượt quá giới hạn cho phép.");
  }

  const note = isBlank(params.noteRaw) ? null : String(params.noteRaw).trim().replace(/\s+/g, " ");
  if (note && note.length > FINANCE_LIMITS.reason) {
    errors.push(`Ghi chú tối đa ${FINANCE_LIMITS.reason} ký tự.`);
  }

  return {
    row: params.row,
    entryDate,
    entryDateDisplay,
    kind: params.expectedKind,
    kindLabel: kindTitle,
    categoryId: catMatch.matched?.id ?? null,
    categoryName: catMatch.matched?.name ?? (categoryText || "—"),
    content,
    amount,
    note,
    errors,
  };
}

export async function previewFinanceImport(
  db: SupabaseClient,
  buffer: ArrayBuffer,
  expectedKind: CategoryKind,
): Promise<FinanceImportPreviewResult | { error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: "Không đọc được file Excel. Vui lòng dùng file định dạng .xlsx (tải từ file mẫu)." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "File Excel không có trang tính nào." };

  const headers = getFinanceTemplateHeaders(expectedKind);
  const mapping = detectHeaders(ws);
  if (!mapping) {
    return {
      error: `Không tìm thấy dòng tiêu đề chuẩn (${headers.slice(0, 4).join(", ")}). Vui lòng tải và dùng đúng file mẫu.`,
    };
  }

  const [categories, lockedThrough] = await Promise.all([loadCategories(db), loadLockedThrough(db)]);
  const rows: FinanceImportPreviewRow[] = [];

  for (let r = mapping.headerRow + 1; r <= ws.rowCount; r++) {
    const rowObj = ws.getRow(r);
    const dateRaw = plainCellValue(rowObj.getCell(mapping.dateCol).value);
    const kindRaw = mapping.kindCol ? plainCellValue(rowObj.getCell(mapping.kindCol).value) : null;
    const categoryRaw = plainCellValue(rowObj.getCell(mapping.categoryCol).value);
    const contentRaw = plainCellValue(rowObj.getCell(mapping.contentCol).value);
    const amountRaw = plainCellValue(rowObj.getCell(mapping.amountCol).value);
    const noteRaw = mapping.noteCol ? plainCellValue(rowObj.getCell(mapping.noteCol).value) : null;

    if (
      isBlank(dateRaw) &&
      isBlank(kindRaw) &&
      isBlank(categoryRaw) &&
      isBlank(contentRaw) &&
      isBlank(amountRaw) &&
      isBlank(noteRaw)
    ) {
      continue;
    }

    if (rows.length >= FINANCE_IMPORT_MAX_ROWS) {
      return { error: `File vượt quá ${FINANCE_IMPORT_MAX_ROWS} dòng dữ liệu. Vui lòng chia nhỏ file.` };
    }

    rows.push(
      validateImportRow({
        row: r,
        expectedKind,
        dateRaw,
        kindRaw,
        categoryRaw,
        contentRaw,
        amountRaw,
        noteRaw,
        categories,
        lockedThrough,
      }),
    );
  }

  if (rows.length === 0) {
    return { error: "File không có dòng dữ liệu nào." };
  }

  return {
    kind: expectedKind,
    rows,
    columns: [...headers],
  };
}

export async function commitFinanceImport(
  db: SupabaseClient,
  actorId: string,
  body: unknown,
  fallbackKind: CategoryKind = "income",
): Promise<FinanceImportCommitResult | { error: string }> {
  const payload = (body && typeof body === "object" ? body : {}) as {
    kind?: unknown;
    rows?: unknown;
  };
  const expectedKind = parseSummaryKind(payload.kind, fallbackKind);
  const rawRows = payload.rows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { error: "Không có dòng dữ liệu hợp lệ nào để lưu." };
  }
  if (rawRows.length > FINANCE_IMPORT_MAX_ROWS) {
    return { error: `Tối đa ${FINANCE_IMPORT_MAX_ROWS} dòng mỗi lần nhập.` };
  }

  const [funds, categories, lockedThrough] = await Promise.all([
    loadFunds(db),
    loadCategories(db),
    loadLockedThrough(db),
  ]);

  const activeFund =
    funds.find((f) => f.is_active && f.kind === "cash") ??
    funds.find((f) => f.is_active && f.kind === "bank") ??
    funds.find((f) => f.is_active) ??
    funds[0];

  if (!activeFund) {
    return { error: "Hệ thống chưa khai báo quỹ nào. Vui lòng tạo quỹ trong phần Cài đặt sổ quỹ trước khi nhập." };
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const result: FinanceImportCommitResult = { imported: 0, skipped: 0, errors: [] };

  type ValidatedCommitItem = {
    row: number;
    entryDate: string;
    kind: CategoryKind;
    categoryId: string;
    content: string;
    amount: number;
    note: string | null;
  };
  const validItems: ValidatedCommitItem[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = (rawRows[i] && typeof rawRows[i] === "object" ? rawRows[i] : {}) as Record<string, unknown>;
    const rowNum = Number.isInteger(r.row) && Number(r.row) > 0 ? Number(r.row) : i + 1;
    const entryDate = typeof r.entryDate === "string" ? r.entryDate.trim() : "";
    const rowKind = r.kind === "income" || r.kind === "expense" ? r.kind : expectedKind;
    const categoryId = typeof r.categoryId === "string" ? r.categoryId.trim() : "";
    const content = typeof r.content === "string" ? r.content.trim().replace(/\s+/g, " ") : "";
    const amount = Math.round(Number(r.amount));
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().replace(/\s+/g, " ") : null;

    const rowErrors: string[] = [];
    if (!isValidDate(entryDate)) rowErrors.push("Ngày không hợp lệ.");
    else if (lockedThrough && entryDate <= lockedThrough) {
      rowErrors.push(`Ngày ${formatDateVi(entryDate)} thuộc kỳ đã khóa sổ.`);
    }
    if (rowKind !== expectedKind) {
      rowErrors.push(`Chỉ cho phép nhập khoản ${expectedKind === "income" ? "thu" : "chi"}.`);
    }
    const cat = categoryById.get(categoryId);
    if (!cat) rowErrors.push("Danh mục không tồn tại.");
    else if (cat.kind !== expectedKind) {
      rowErrors.push(`Danh mục không thuộc nhóm ${expectedKind === "income" ? "thu" : "chi"}.`);
    }
    if (!content || content.length > FINANCE_LIMITS.description) rowErrors.push("Nội dung không hợp lệ.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > FINANCE_LIMITS.maxAmount) {
      rowErrors.push("Số tiền không hợp lệ.");
    }
    if (note && note.length > FINANCE_LIMITS.reason) {
      rowErrors.push("Ghi chú quá dài.");
    }

    if (rowErrors.length > 0 || !cat) {
      result.skipped += 1;
      result.errors.push({ row: rowNum, message: rowErrors.join(" ") });
      continue;
    }

    validItems.push({
      row: rowNum,
      entryDate,
      kind: expectedKind,
      categoryId: cat.id,
      content,
      amount,
      note,
    });
  }

  if (validItems.length === 0) {
    return result;
  }

  // Nếu có dòng hợp lệ có ngày trước opening_date của quỹ và kỳ đó chưa khóa sổ, tự động lùi opening_date của quỹ để ghi được bút toán lịch sử
  const earliestDate = validItems.reduce(
    (min, item) => (item.entryDate < min ? item.entryDate : min),
    validItems[0].entryDate,
  );
  if (earliestDate < activeFund.opening_date && (!lockedThrough || earliestDate > lockedThrough)) {
    await db
      .from(CDILV_TABLE.funds)
      .update({ opening_date: earliestDate, updated_by: actorId, updated_at: new Date().toISOString() })
      .eq("id", activeFund.id);
  }

  for (const item of validItems) {
    try {
      const rpcPayload = entryRpcData({
        entryDate: item.entryDate,
        kind: item.kind,
        fundId: activeFund.id,
        toFundId: null,
        categoryId: item.categoryId,
        amount: item.amount,
        description: item.content,
        counterparty: null,
        documentNo: null,
      });
      const { error } = await db.rpc(CDILV_RPC.fundEntrySave, {
        p_entry_id: null,
        p_actor_id: actorId,
        p_data: rpcPayload,
        p_note: item.note,
      });
      if (error) {
        result.skipped += 1;
        result.errors.push({ row: item.row, message: error.message });
      } else {
        result.imported += 1;
      }
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: item.row,
        message: err instanceof Error ? err.message : "Không lưu được dòng này.",
      });
    }
  }

  return result;
}

export async function buildFinanceImportTemplate(
  categories: FundCategory[],
  kind: CategoryKind,
): Promise<Buffer> {
  const isIncome = kind === "income";
  const kindNoun = isIncome ? "thu" : "chi";
  const headers = getFinanceTemplateHeaders(kind);
  const sheetTitle = isIncome ? "Nhập khoản thu" : "Nhập khoản chi";
  const guideTitle = isIncome ? "Danh mục thu & Hướng dẫn" : "Danh mục chi & Hướng dẫn";

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetTitle, { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { width: 16, style: { numFmt: "@" } },
    { width: 40, style: { numFmt: "@" } },
    { width: 48, style: { numFmt: "@" } },
    { width: 20, style: { numFmt: "#,##0" } },
    { width: 32, style: { numFmt: "@" } },
  ];

  const headerRow = ws.getRow(1);
  headers.forEach((text, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = text;
    cell.font = { bold: true, color: { argb: "FF173A67" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 28;

  const activeOfKind = categories.filter((c) => c.is_active && c.kind === kind);
  const firstCat = activeOfKind[0]?.name ?? (isIncome ? "Thu đoàn phí công đoàn" : "Chi thăm hỏi, trợ cấp đoàn viên");
  const secondCat =
    activeOfKind[1]?.name ?? firstCat;

  const sampleRows: [string, string, string, number, string][] = isIncome
    ? [
        ["15/10/2026", firstCat, "Thu đoàn phí công đoàn tháng 10/2026", 15000000, "Theo danh sách trích nộp T10"],
        ["20/10/2026", secondCat, "Kinh phí công đoàn cấp bổ sung đợt 2", 10000000, "Chứng từ ngân hàng"],
      ]
    : [
        ["20/10/2026", firstCat, "Chi thăm hỏi đoàn viên ốm đau tháng 10/2026", 2000000, "Kèm đề nghị thăm hỏi"],
        ["25/10/2026", secondCat, "Chi tổ chức hoạt động phong trào tháng 10/2026", 5000000, "Theo quyết định duyệt chi"],
      ];

  sampleRows.forEach((vals, idx) => {
    const row = ws.getRow(idx + 2);
    vals.forEach((v, colIdx) => {
      row.getCell(colIdx + 1).value = v;
    });
  });

  // Sheet 2: Danh mục & Hướng dẫn (chỉ gồm danh mục của đúng loại Thu hoặc Chi)
  const guide = wb.addWorksheet(guideTitle);
  guide.columns = [{ width: 24 }, { width: 45 }, { width: 55 }];

  const titleRow = guide.getRow(1);
  titleRow.getCell(1).value = isIncome
    ? "HƯỚNG DẪN NHẬP CÁC KHOẢN THU TỪ EXCEL"
    : "HƯỚNG DẪN NHẬP CÁC KHOẢN CHI TỪ EXCEL";
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: "FF173A67" } };

  const instructions: [string, string][] = [
    ["Cột Ngày", "Nhập theo định dạng dd/mm/yyyy (VD: 25/10/2026) hoặc yyyy-mm-dd."],
    [`Cột Danh mục ${kindNoun}`, `Chọn hoặc ghi đúng tên danh mục ${kindNoun} (hoặc mã danh mục) theo bảng bên dưới.`],
    [`Cột Nội dung ${kindNoun}`, `Diễn giải chi tiết khoản ${kindNoun} (bắt buộc, tối đa 300 ký tự).`],
    [`Cột Số tiền ${kindNoun}`, `Số tiền ${kindNoun} nguyên dương tính bằng VNĐ (VD: 15000000).`],
    ["Cột Ghi chú", "Ghi chú bổ sung (tùy chọn)."],
  ];

  instructions.forEach(([k, v], i) => {
    const r = guide.getRow(i + 3);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = v;
  });

  const catStartRow = instructions.length + 5;
  const catHeader = guide.getRow(catStartRow);
  ["STT", `Mã danh mục ${kindNoun}`, `Tên danh mục ${kindNoun} chuẩn trong hệ thống`].forEach((h, i) => {
    const cell = catHeader.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FF173A67" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
  });

  activeOfKind.forEach((c, idx) => {
    const r = guide.getRow(catStartRow + 1 + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = c.code ?? "";
    r.getCell(3).value = c.name;
  });

  if (activeOfKind.length > 0) {
    const firstCatRow = catStartRow + 1;
    const lastCatRow = catStartRow + activeOfKind.length;
    const formulaRange = `'${guideTitle}'!$C$${firstCatRow}:$C$${lastCatRow}`;
    for (let r = 2; r <= 500; r++) {
      ws.getCell(r, 2).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formulaRange],
        showErrorMessage: false,
      };
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildFinanceSummaryExport(
  summary: ComputedFinanceSummary,
  unionName: string,
  kind: CategoryKind,
): Promise<Buffer> {
  const isIncome = kind === "income";
  const kindNoun = isIncome ? "thu" : "chi";
  const kindUpper = isIncome ? "THU" : "CHI";
  const categoryRows = isIncome ? summary.incomeRows : summary.expenseRows;
  const totalKindAmount = isIncome ? summary.totalIncome : summary.totalExpense;
  const totalKindCount = isIncome ? summary.incomeEntryCount : summary.expenseEntryCount;
  const detailRows = summary.detailRows.filter((d) => d.kind === kind);

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Tổng hợp thu (hoặc Tổng hợp chi)
  const ws = wb.addWorksheet(isIncome ? "Tổng hợp thu" : "Tổng hợp chi");
  ws.columns = [
    { width: 8 },
    { width: 16 },
    { width: 44 },
    { width: 16 },
    { width: 22 },
    { width: 14 },
    { width: 36 },
  ];

  ws.getRow(1).getCell(1).value = unionName.toUpperCase();
  ws.getRow(1).getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

  ws.getRow(2).getCell(1).value = `BÁO CÁO TỔNG HỢP ${kindUpper} CÔNG ĐOÀN (${summary.periodLabel.toUpperCase()})`;
  ws.getRow(2).getCell(1).font = { bold: true, size: 14, color: { argb: "FF173A67" } };

  ws.getRow(3).getCell(1).value = `Kỳ báo cáo: ${summary.periodLabel} (Từ ngày ${formatDateVi(summary.fromDate)} đến ngày ${formatDateVi(summary.toDate)})`;
  ws.getRow(3).getCell(1).font = { italic: true, size: 10 };

  let cursor = 5;
  const balanceHeader = ws.getRow(cursor++);
  balanceHeader.getCell(1).value = `I. SỐ DƯ ĐẦU KỲ & TỔNG HỢP ${kindUpper} TRONG KỲ`;
  balanceHeader.getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

  const sourceLabel =
    summary.openingSource === "manual"
      ? `Số dư kết chuyển nhập trực tiếp cho ${summary.periodLabel}${summary.openingNote ? ` (${summary.openingNote})` : ""}`
      : summary.openingSource === "carried"
        ? `Tự động kết chuyển từ ${summary.openingCheckpointLabel ?? "kỳ trước"}`
        : "Tự động tính từ số dư đầu kỳ các quỹ";

  const balanceItems: [string, number, string][] = isIncome
    ? [
        ["1. Số dư đầu kỳ", summary.openingBalance, sourceLabel],
        ["2. Tổng thu trong kỳ", summary.totalIncome, `${summary.incomeEntryCount} phiếu thu`],
        ["3. Tổng nguồn quỹ khả dụng trong kỳ (Đầu kỳ + Tổng thu)", summary.openingBalance + summary.totalIncome, ""],
        ["4. Tổng chi đối ứng trong kỳ", summary.totalExpense, `${summary.expenseEntryCount} phiếu chi`],
        ["5. Số dư cuối kỳ (Đầu kỳ + Thu - Chi)", summary.closingBalance, "Kết chuyển sang kỳ tiếp theo"],
      ]
    : [
        ["1. Số dư đầu kỳ", summary.openingBalance, sourceLabel],
        ["2. Tổng chi trong kỳ", summary.totalExpense, `${summary.expenseEntryCount} phiếu chi`],
        ["3. Tổng thu đối ứng trong kỳ", summary.totalIncome, `${summary.incomeEntryCount} phiếu thu`],
        ["4. Chênh lệch thu – chi trong kỳ (Thu - Chi)", summary.netAmount, ""],
        ["5. Số dư cuối kỳ (Đầu kỳ + Thu - Chi)", summary.closingBalance, "Kết chuyển sang kỳ tiếp theo"],
      ];

  for (const [label, amount, note] of balanceItems) {
    const r = ws.getRow(cursor++);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: label.startsWith("1.") || label.startsWith("2.") || label.startsWith("5.") };
    ws.mergeCells(r.number, 1, r.number, 3);
    const amountCell = r.getCell(5);
    amountCell.value = amount;
    amountCell.numFmt = "#,##0";
    amountCell.font = { bold: true };
    r.getCell(7).value = note;
  }

  cursor += 1;

  // Khối Bảng tổng hợp theo danh mục (chỉ Thu hoặc chỉ Chi)
  const secRow = ws.getRow(cursor++);
  secRow.getCell(1).value = `II. BẢNG TỔNG HỢP ${kindUpper} THEO DANH MỤC`;
  secRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

  const tblHeader = ws.getRow(cursor++);
  [
    "STT",
    `Mã DM ${kindNoun}`,
    `Danh mục ${kindNoun}`,
    `Số phiếu ${kindNoun}`,
    `Tổng tiền ${kindNoun} (VNĐ)`,
    "Tỷ trọng (%)",
    "Ghi chú / Diễn giải",
  ].forEach((h, i) => {
    const c = tblHeader.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FF173A67" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
    c.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  categoryRows.forEach((item, idx) => {
    const r = ws.getRow(cursor++);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = item.code ?? "";
    r.getCell(3).value = item.name;
    r.getCell(4).value = item.entryCount;
    r.getCell(4).numFmt = "#,##0";
    r.getCell(5).value = item.totalAmount;
    r.getCell(5).numFmt = "#,##0";
    r.getCell(6).value = item.percentage;
    r.getCell(6).numFmt = "0.0";
    r.getCell(7).value = item.sampleNote ?? "";
    for (let col = 1; col <= 7; col++) {
      r.getCell(col).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });

  const totalRow = ws.getRow(cursor++);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "";
  totalRow.getCell(3).value = `Tổng cộng ${kindNoun}`;
  totalRow.getCell(4).value = totalKindCount;
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(5).value = totalKindAmount;
  totalRow.getCell(5).numFmt = "#,##0";
  totalRow.getCell(6).value = totalKindAmount > 0 ? 100 : 0;
  totalRow.getCell(6).numFmt = "0.0";
  totalRow.getCell(7).value = "";
  for (let col = 1; col <= 7; col++) {
    totalRow.getCell(col).font = { bold: true, color: { argb: "FF173A67" } };
    totalRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F7FB" } };
    totalRow.getCell(col).border = {
      top: { style: "thin" },
      bottom: { style: "double" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  }

  // Sheet 2: Chi tiết các khoản thu (hoặc chi) trong kỳ — chỉ các cột của đúng loại đó
  const detailWs = wb.addWorksheet(isIncome ? "Chi tiết khoản thu" : "Chi tiết khoản chi", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  detailWs.columns = [
    { width: 8 },
    { width: 14 },
    { width: 16 },
    { width: 34 },
    { width: 46 },
    { width: 20 },
    { width: 22 },
    { width: 30 },
  ];

  detailWs.getRow(1).getCell(1).value = unionName.toUpperCase();
  detailWs.getRow(1).getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };
  detailWs.getRow(2).getCell(1).value = `CHI TIẾT CÁC KHOẢN ${kindUpper} TRONG KỲ (${summary.periodLabel.toUpperCase()})`;
  detailWs.getRow(2).getCell(1).font = { bold: true, size: 13, color: { argb: "FF173A67" } };

  const dHeader = detailWs.getRow(4);
  [
    "STT",
    "Ngày",
    `Số phiếu ${kindNoun}`,
    `Danh mục ${kindNoun}`,
    `Nội dung ${kindNoun}`,
    `Số tiền ${kindNoun} (VNĐ)`,
    "Quỹ",
    "Ghi chú",
  ].forEach((h, i) => {
    const c = dHeader.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FF173A67" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
    c.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  detailRows.forEach((d, idx) => {
    const r = detailWs.getRow(5 + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = formatDateVi(d.entryDate);
    r.getCell(3).value = d.code;
    r.getCell(4).value = d.categoryName;
    r.getCell(5).value = d.description;
    r.getCell(6).value = d.amount;
    r.getCell(6).numFmt = "#,##0";
    r.getCell(7).value = d.fundName;
    r.getCell(8).value = d.note ?? "";
    for (let col = 1; col <= 8; col++) {
      r.getCell(col).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });

  const dTotalRow = detailWs.getRow(5 + detailRows.length);
  dTotalRow.getCell(5).value = `Tổng cộng ${kindNoun} trong kỳ`;
  dTotalRow.getCell(6).value = totalKindAmount;
  dTotalRow.getCell(6).numFmt = "#,##0";
  for (let col = 1; col <= 8; col++) {
    dTotalRow.getCell(col).font = { bold: true, color: { argb: "FF173A67" } };
    dTotalRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F7FB" } };
    dTotalRow.getCell(col).border = {
      top: { style: "thin" },
      bottom: { style: "double" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
