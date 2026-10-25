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

export const FINANCE_TEMPLATE_HEADERS = [
  "Ngày",
  "Loại thu/chi",
  "Danh mục",
  "Nội dung",
  "Số tiền",
  "Ghi chú",
] as const;

export type FinanceImportPreviewRow = {
  row: number;
  entryDate: string | null;
  entryDateDisplay: string;
  kind: CategoryKind | null;
  kindLabel: string;
  categoryId: string | null;
  categoryName: string;
  content: string;
  amount: number | null;
  note: string | null;
  errors: string[];
};

export type FinanceImportPreviewResult = {
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
  kind: CategoryKind | null,
  categories: FundCategory[],
): { matched: FundCategory | null; error: string | null } {
  const trimmed = rawCategory.trim();
  if (!trimmed) {
    return { matched: null, error: "Thiếu danh mục thu/chi." };
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
    // Thử khớp một phần nếu chỉ có duy nhất 1 danh mục cùng loại chứa từ khóa
    const partial = activeCategories.filter(
      (c) => (!kind || c.kind === kind) && (fold(c.name).includes(f) || f.includes(fold(c.name))),
    );
    if (partial.length === 1) {
      return { matched: partial[0], error: null };
    }
    return {
      matched: null,
      error: `Danh mục “${trimmed}” không tồn tại trong hệ thống (vui lòng chọn đúng tên danh mục ở trang Danh mục & Hướng dẫn).`,
    };
  }

  if (kind) {
    const sameKind = candidates.find((c) => c.kind === kind);
    if (!sameKind) {
      const wrongKind = candidates[0];
      return {
        matched: null,
        error: `Danh mục “${wrongKind.name}” thuộc nhóm ${wrongKind.kind === "income" ? "Thu" : "Chi"}, không khớp với loại “${kind === "income" ? "Thu" : "Chi"}”.`,
      };
    }
    return { matched: sameKind, error: null };
  }

  return { matched: candidates[0], error: null };
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
      if (!dateCol && ["ngay", "ngay ghi so", "ngay phat sinh", "date"].includes(f)) dateCol = col;
      else if (!kindCol && ["loai thu/chi", "loai", "loai phieu", "thu/chi", "thu / chi", "type"].includes(f))
        kindCol = col;
      else if (!categoryCol && ["danh muc", "danh muc thu chi", "danh muc thu/chi", "category"].includes(f))
        categoryCol = col;
      else if (!contentCol && ["noi dung", "dien giai", "noi dung thu chi", "content", "description"].includes(f))
        contentCol = col;
      else if (!amountCol && ["so tien", "so tien (vnd)", "so tien vnd", "thanh tien", "amount"].includes(f))
        amountCol = col;
      else if (!noteCol && ["ghi chu", "chu thich", "note", "notes"].includes(f)) noteCol = col;
    });

    if (dateCol && kindCol && categoryCol && contentCol && amountCol) {
      return { headerRow: r, dateCol, kindCol, categoryCol, contentCol, amountCol, noteCol };
    }
  }
  return null;
}

function validateImportRow(params: {
  row: number;
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

  const kind = parseKindValue(params.kindRaw);
  const kindLabel =
    kind === "income"
      ? "Thu"
      : kind === "expense"
        ? "Chi"
        : isBlank(params.kindRaw)
          ? "—"
          : String(params.kindRaw).trim();
  if (!kind) {
    errors.push("Loại thu/chi chỉ nhận “Thu” hoặc “Chi”.");
  }

  const categoryText = isBlank(params.categoryRaw) ? "" : String(params.categoryRaw).trim();
  const catMatch = matchCategory(categoryText, kind, params.categories);
  if (catMatch.error) {
    errors.push(catMatch.error);
  }

  const content = isBlank(params.contentRaw) ? "" : String(params.contentRaw).trim().replace(/\s+/g, " ");
  if (!content) {
    errors.push("Thiếu nội dung thu/chi.");
  } else if (content.length > FINANCE_LIMITS.description) {
    errors.push(`Nội dung tối đa ${FINANCE_LIMITS.description} ký tự.`);
  }

  const amount = parseAmountValue(params.amountRaw);
  if (amount === null || amount <= 0) {
    errors.push("Số tiền phải là số nguyên dương lớn hơn 0.");
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
    kind,
    kindLabel,
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
): Promise<FinanceImportPreviewResult | { error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: "Không đọc được file Excel. Vui lòng dùng file định dạng .xlsx (tải từ file mẫu)." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "File Excel không có trang tính nào." };

  const mapping = detectHeaders(ws);
  if (!mapping) {
    return {
      error: `Không tìm thấy dòng tiêu đề chuẩn (${FINANCE_TEMPLATE_HEADERS.slice(0, 5).join(", ")}). Vui lòng tải và dùng đúng file mẫu.`,
    };
  }

  const [categories, lockedThrough] = await Promise.all([loadCategories(db), loadLockedThrough(db)]);
  const rows: FinanceImportPreviewRow[] = [];

  for (let r = mapping.headerRow + 1; r <= ws.rowCount; r++) {
    const rowObj = ws.getRow(r);
    const dateRaw = plainCellValue(rowObj.getCell(mapping.dateCol).value);
    const kindRaw = plainCellValue(rowObj.getCell(mapping.kindCol).value);
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
    rows,
    columns: [...FINANCE_TEMPLATE_HEADERS],
  };
}

export async function commitFinanceImport(
  db: SupabaseClient,
  actorId: string,
  body: unknown,
): Promise<FinanceImportCommitResult | { error: string }> {
  const rawRows = (body as { rows?: unknown } | null)?.rows;
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
    const kind = r.kind === "income" || r.kind === "expense" ? r.kind : null;
    const categoryId = typeof r.categoryId === "string" ? r.categoryId.trim() : "";
    const content = typeof r.content === "string" ? r.content.trim().replace(/\s+/g, " ") : "";
    const amount = Math.round(Number(r.amount));
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().replace(/\s+/g, " ") : null;

    const rowErrors: string[] = [];
    if (!isValidDate(entryDate)) rowErrors.push("Ngày không hợp lệ.");
    else if (lockedThrough && entryDate <= lockedThrough) {
      rowErrors.push(`Ngày ${formatDateVi(entryDate)} thuộc kỳ đã khóa sổ.`);
    }
    if (!kind) rowErrors.push("Loại thu/chi không hợp lệ.");
    const cat = categoryById.get(categoryId);
    if (!cat) rowErrors.push("Danh mục không tồn tại.");
    else if (kind && cat.kind !== kind) rowErrors.push("Danh mục không khớp loại thu/chi.");
    if (!content || content.length > FINANCE_LIMITS.description) rowErrors.push("Nội dung không hợp lệ.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > FINANCE_LIMITS.maxAmount) {
      rowErrors.push("Số tiền không hợp lệ.");
    }
    if (note && note.length > FINANCE_LIMITS.reason) {
      rowErrors.push("Ghi chú quá dài.");
    }

    if (rowErrors.length > 0 || !kind || !cat) {
      result.skipped += 1;
      result.errors.push({ row: rowNum, message: rowErrors.join(" ") });
      continue;
    }

    validItems.push({
      row: rowNum,
      entryDate,
      kind,
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

export async function buildFinanceImportTemplate(categories: FundCategory[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Nhập thu chi", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { width: 16, style: { numFmt: "@" } },
    { width: 16, style: { numFmt: "@" } },
    { width: 38, style: { numFmt: "@" } },
    { width: 46, style: { numFmt: "@" } },
    { width: 18, style: { numFmt: "#,##0" } },
    { width: 32, style: { numFmt: "@" } },
  ];

  const headerRow = ws.getRow(1);
  FINANCE_TEMPLATE_HEADERS.forEach((text, idx) => {
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

  const activeIncome = categories.filter((c) => c.is_active && c.kind === "income");
  const activeExpense = categories.filter((c) => c.is_active && c.kind === "expense");
  const sampleIncomeCat = activeIncome[0]?.name ?? "Thu đoàn phí công đoàn";
  const sampleExpenseCat = activeExpense[0]?.name ?? "Chi thăm hỏi, trợ cấp đoàn viên";

  // Dòng mẫu minh họa
  const sampleRows: [string, string, string, string, number, string][] = [
    ["15/10/2026", "Thu", sampleIncomeCat, "Thu đoàn phí công đoàn tháng 10/2026", 15000000, "Theo danh sách trích nộp T10"],
    ["20/10/2026", "Chi", sampleExpenseCat, "Chi thăm hỏi đoàn viên ốm đau tháng 10/2026", 2000000, "Kèm đề nghị thăm hỏi"],
  ];

  sampleRows.forEach((vals, idx) => {
    const row = ws.getRow(idx + 2);
    vals.forEach((v, colIdx) => {
      row.getCell(colIdx + 1).value = v;
    });
  });

  // Data validation cho cột Loại thu/chi (cột 2)
  for (let r = 2; r <= 500; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Thu,Chi"'],
      showErrorMessage: true,
      errorTitle: "Loại thu/chi",
      error: "Chỉ chọn Thu hoặc Chi",
    };
  }

  // Sheet 2: Danh mục & Hướng dẫn
  const guide = wb.addWorksheet("Danh mục & Hướng dẫn");
  guide.columns = [{ width: 22 }, { width: 45 }, { width: 55 }];

  const titleRow = guide.getRow(1);
  titleRow.getCell(1).value = "HƯỚNG DẪN NHẬP THU – CHI TỪ EXCEL";
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: "FF173A67" } };

  const instructions: [string, string][] = [
    ["Cột Ngày", "Nhập theo định dạng dd/mm/yyyy (VD: 25/10/2026) hoặc yyyy-mm-dd."],
    ["Cột Loại thu/chi", "Ghi “Thu” (phiếu thu) hoặc “Chi” (phiếu chi)."],
    ["Cột Danh mục", "Ghi đúng tên danh mục (hoặc mã danh mục) theo bảng danh mục bên dưới."],
    ["Cột Nội dung", "Diễn giải chi tiết nội dung khoản thu/chi (bắt buộc, tối đa 300 ký tự)."],
    ["Cột Số tiền", "Số tiền VNĐ nguyên dương (VD: 15000000)."],
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
  ["Loại", "Mã danh mục", "Tên danh mục chuẩn trong hệ thống"].forEach((h, i) => {
    const cell = catHeader.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FF173A67" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2EC" } };
  });

  const allActive = [...activeIncome, ...activeExpense];
  allActive.forEach((c, idx) => {
    const r = guide.getRow(catStartRow + 1 + idx);
    r.getCell(1).value = c.kind === "income" ? "Thu" : "Chi";
    r.getCell(2).value = c.code ?? "";
    r.getCell(3).value = c.name;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildFinanceSummaryExport(
  summary: ComputedFinanceSummary,
  unionName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Tổng hợp thu chi
  const ws = wb.addWorksheet("Tổng hợp thu chi");
  ws.columns = [
    { width: 8 },
    { width: 16 },
    { width: 44 },
    { width: 16 },
    { width: 22 },
    { width: 14 },
    { width: 36 },
  ];

  const addHeaderBlock = () => {
    ws.getRow(1).getCell(1).value = unionName.toUpperCase();
    ws.getRow(1).getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

    ws.getRow(2).getCell(1).value = `BÁO CÁO TỔNG HỢP THU – CHI CÔNG ĐOÀN (${summary.periodLabel.toUpperCase()})`;
    ws.getRow(2).getCell(1).font = { bold: true, size: 14, color: { argb: "FF173A67" } };

    ws.getRow(3).getCell(1).value = `Kỳ báo cáo: ${summary.periodLabel} (Từ ngày ${formatDateVi(summary.fromDate)} đến ngày ${formatDateVi(summary.toDate)})`;
    ws.getRow(3).getCell(1).font = { italic: true, size: 10 };
  };
  addHeaderBlock();

  // Khối cân đối số dư
  let cursor = 5;
  const balanceHeader = ws.getRow(cursor++);
  balanceHeader.getCell(1).value = "I. CÂN ĐỐI THU – CHI & SỐ DƯ TRONG KỲ";
  balanceHeader.getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

  const sourceLabel =
    summary.openingSource === "manual"
      ? `Số dư kết chuyển nhập trực tiếp cho ${summary.periodLabel}${summary.openingNote ? ` (${summary.openingNote})` : ""}`
      : summary.openingSource === "carried"
        ? `Tự động kết chuyển từ ${summary.openingCheckpointLabel ?? "kỳ trước"}`
        : "Tự động tính từ số dư đầu kỳ các quỹ";

  const balanceItems: [string, number, string][] = [
    ["1. Số dư đầu kỳ", summary.openingBalance, sourceLabel],
    ["2. Tổng thu trong kỳ", summary.totalIncome, `${summary.incomeEntryCount} bút toán thu`],
    ["3. Tổng chi trong kỳ", summary.totalExpense, `${summary.expenseEntryCount} bút toán chi`],
    ["4. Chênh lệch thu – chi trong kỳ (Thu - Chi)", summary.netAmount, ""],
    ["5. Số dư cuối kỳ (Đầu kỳ + Thu - Chi)", summary.closingBalance, "Kết chuyển sang kỳ tiếp theo"],
  ];

  for (const [label, amount, note] of balanceItems) {
    const r = ws.getRow(cursor++);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: label.startsWith("1.") || label.startsWith("5.") };
    ws.mergeCells(r.number, 1, r.number, 3);
    const amountCell = r.getCell(5);
    amountCell.value = amount;
    amountCell.numFmt = "#,##0";
    amountCell.font = { bold: true };
    r.getCell(7).value = note;
  }

  cursor += 1;

  // Khối Tổng hợp thu
  const writeCategoryTable = (
    sectionTitle: string,
    rows: ComputedFinanceSummary["incomeRows"],
    totalAmount: number,
    totalCount: number,
  ) => {
    const secRow = ws.getRow(cursor++);
    secRow.getCell(1).value = sectionTitle;
    secRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };

    const tblHeader = ws.getRow(cursor++);
    ["STT", "Mã DM", "Danh mục", "Số bút toán", "Tổng số tiền (VNĐ)", "Tỷ trọng (%)", "Ghi chú / Diễn giải"].forEach(
      (h, i) => {
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
      },
    );

    rows.forEach((item, idx) => {
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
    totalRow.getCell(3).value = "Tổng cộng";
    totalRow.getCell(4).value = totalCount;
    totalRow.getCell(4).numFmt = "#,##0";
    totalRow.getCell(5).value = totalAmount;
    totalRow.getCell(5).numFmt = "#,##0";
    totalRow.getCell(6).value = totalAmount > 0 ? 100 : 0;
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

    cursor += 1;
  };

  writeCategoryTable(
    "II. BẢNG TỔNG HỢP THU THEO DANH MỤC",
    summary.incomeRows,
    summary.totalIncome,
    summary.incomeEntryCount,
  );

  writeCategoryTable(
    "III. BẢNG TỔNG HỢP CHI THEO DANH MỤC",
    summary.expenseRows,
    summary.totalExpense,
    summary.expenseEntryCount,
  );

  // Sheet 2: Chi tiết phát sinh thu chi trong kỳ
  const detailWs = wb.addWorksheet("Chi tiết thu chi", { views: [{ state: "frozen", ySplit: 4 }] });
  detailWs.columns = [
    { width: 8 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 32 },
    { width: 44 },
    { width: 18 },
    { width: 18 },
    { width: 30 },
  ];

  detailWs.getRow(1).getCell(1).value = unionName.toUpperCase();
  detailWs.getRow(1).getCell(1).font = { bold: true, size: 11, color: { argb: "FF173A67" } };
  detailWs.getRow(2).getCell(1).value = `CHI TIẾT CÁC KHOẢN THU – CHI TRONG KỲ (${summary.periodLabel.toUpperCase()})`;
  detailWs.getRow(2).getCell(1).font = { bold: true, size: 13, color: { argb: "FF173A67" } };

  const dHeader = detailWs.getRow(4);
  ["STT", "Ngày", "Số phiếu", "Loại", "Danh mục", "Nội dung", "Số tiền thu", "Số tiền chi", "Ghi chú"].forEach(
    (h, i) => {
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
    },
  );

  summary.detailRows.forEach((d, idx) => {
    const r = detailWs.getRow(5 + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = formatDateVi(d.entryDate);
    r.getCell(3).value = d.code;
    r.getCell(4).value = d.kind === "income" ? "Thu" : "Chi";
    r.getCell(5).value = d.categoryName;
    r.getCell(6).value = d.description;
    r.getCell(7).value = d.kind === "income" ? d.amount : null;
    r.getCell(7).numFmt = "#,##0";
    r.getCell(8).value = d.kind === "expense" ? d.amount : null;
    r.getCell(8).numFmt = "#,##0";
    r.getCell(9).value = d.note ?? "";
    for (let col = 1; col <= 9; col++) {
      r.getCell(col).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });

  const dTotalRow = detailWs.getRow(5 + summary.detailRows.length);
  dTotalRow.getCell(6).value = "Tổng cộng phát sinh trong kỳ";
  dTotalRow.getCell(7).value = summary.totalIncome;
  dTotalRow.getCell(7).numFmt = "#,##0";
  dTotalRow.getCell(8).value = summary.totalExpense;
  dTotalRow.getCell(8).numFmt = "#,##0";
  for (let col = 1; col <= 9; col++) {
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
