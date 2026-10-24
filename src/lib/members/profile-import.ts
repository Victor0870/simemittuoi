import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentAccess, type CurrentAccess } from "@/lib/auth/guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { DETAIL_COLUMNS, saveMemberProfile } from "@/lib/members/profile-server";
import {
  DETAIL_FIELD_LABEL,
  EMPTY_DETAILS,
  GENDER_LABEL,
  MARITAL_STATUS_LABEL,
  formatDateVi,
  normalizeDetails,
  validateProfile,
  type MemberChild,
  type MemberDetails,
} from "@/lib/members/profile-shared";
import { CDILV_TABLE } from "@/lib/supabase/tables";

/**
 * Nhập hồ sơ đoàn viên từ Excel: chỉ cập nhật các trường MemberDetails theo Mã NV.
 * Không bao giờ đụng tới CCCD, thông tin con, vai trò, điểm hay tài khoản.
 */

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_CODE_HEADER = "Mã NV";
export const IMPORT_FIELDS = Object.keys(DETAIL_FIELD_LABEL) as (keyof MemberDetails)[];

export type ImportChange = { field: keyof MemberDetails; label: string; old: string | null; new: string | null };

export type ImportPreviewRow = {
  row: number;
  employee_code: string | null;
  member_name: string | null;
  /** Giá trị đã chuẩn hóa của các ô có dữ liệu — gửi lại nguyên trạng khi xác nhận. */
  details: Partial<MemberDetails>;
  changes: ImportChange[];
  errors: string[];
};

export type ImportPreviewResult = { rows: ImportPreviewRow[]; columns: string[] };

export type ImportCommitError = { row: number | null; employee_code: string; message: string };

export type ImportCommitResult = { updated: number; skipped: number; errors: ImportCommitError[] };

/** Người nhập phải có cả members.import và members.edit. */
export async function requireMemberImportAccess(): Promise<CurrentAccess | NextResponse> {
  const access = await getCurrentAccess();
  if (!access) {
    return NextResponse.json({ error: "Vui lòng đăng nhập tài khoản." }, { status: 401 });
  }
  if (!hasPermission(access, PERMISSIONS.membersImport) || !hasPermission(access, PERMISSIONS.membersEdit)) {
    return NextResponse.json(
      { error: "Bạn chưa được phân quyền nhập hồ sơ đoàn viên từ Excel." },
      { status: 403 },
    );
  }
  return access;
}

// ---------------------------------------------------------------------------
// Đọc giá trị ô

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const codeKey = (code: string) => code.trim().toUpperCase();

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

/** dd/mm/yyyy, yyyy-mm-dd, ô ngày của Excel hoặc số seri ngày của Excel. */
function parseDateValue(raw: unknown): string | null {
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
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function matchLabel<K extends string>(raw: unknown, labels: Record<K, string>): K | null {
  if (typeof raw !== "string") return null;
  const value = fold(raw);
  const keys = Object.keys(labels) as K[];
  return keys.find((k) => fold(labels[k]) === value || k === raw.trim()) ?? null;
}

function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (raw === 1) return true;
  if (raw === 0) return false;
  if (typeof raw !== "string") return null;
  const value = fold(raw);
  if (["co", "x", "yes", "true", "1"].includes(value)) return true;
  if (["khong", "no", "false", "0"].includes(value)) return false;
  return null;
}

type ParsedField =
  | { kind: "empty" }
  | { kind: "ok"; value: MemberDetails[keyof MemberDetails] }
  | { kind: "error"; message: string };

/** Nhận cả giá trị đọc từ Excel lẫn giá trị đã chuẩn hóa (khi xác nhận). Ô trống = giữ nguyên. */
function parseField(field: keyof MemberDetails, raw: unknown): ParsedField {
  if (isBlank(raw)) return { kind: "empty" };
  const label = DETAIL_FIELD_LABEL[field];
  switch (field) {
    case "date_of_birth": {
      const iso = parseDateValue(raw);
      return iso
        ? { kind: "ok", value: iso }
        : { kind: "error", message: `${label}: ngày không hợp lệ (nhập dạng dd/mm/yyyy).` };
    }
    case "gender": {
      const key = matchLabel(raw, GENDER_LABEL);
      return key
        ? { kind: "ok", value: key }
        : { kind: "error", message: `${label}: chỉ nhận “${Object.values(GENDER_LABEL).join("” hoặc “")}”.` };
    }
    case "marital_status": {
      const key = matchLabel(raw, MARITAL_STATUS_LABEL);
      return key
        ? { kind: "ok", value: key }
        : {
            kind: "error",
            message: `${label}: chỉ nhận “${Object.values(MARITAL_STATUS_LABEL).join("” hoặc “")}”.`,
          };
    }
    case "no_children": {
      const value = parseBoolean(raw);
      return value === null
        ? { kind: "error", message: `${label}: chỉ nhận “Có” hoặc “Không”.` }
        : { kind: "ok", value };
    }
    default: {
      if (typeof raw === "number") {
        if (!Number.isSafeInteger(raw) && Number.isInteger(raw)) {
          return {
            kind: "error",
            message: `${label}: số quá dài nên Excel đã làm tròn, hãy định dạng cột là Text rồi nhập lại.`,
          };
        }
        const text = String(raw);
        return { kind: "ok", value: field === "phone" && /^\d{9}$/.test(text) ? `0${text}` : text };
      }
      if (typeof raw === "string") return { kind: "ok", value: raw.trim() };
      return { kind: "error", message: `${label}: giá trị không hợp lệ.` };
    }
  }
}

function formatImportValue(field: keyof MemberDetails, value: MemberDetails[keyof MemberDetails]): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field === "date_of_birth") return formatDateVi(value as string);
  if (field === "gender") return GENDER_LABEL[value as keyof typeof GENDER_LABEL] ?? String(value);
  if (field === "marital_status") return MARITAL_STATUS_LABEL[value as keyof typeof MARITAL_STATUS_LABEL] ?? String(value);
  if (field === "no_children") return value ? "Có" : "Không";
  return String(value);
}

// ---------------------------------------------------------------------------
// Dữ liệu hiện tại

type ImportMember = { id: string; full_name: string; employee_code: string };

type CurrentProfile = {
  details: MemberDetails;
  children: MemberChild[];
  identity: { issue_date: string | null; issue_place: string | null } | null;
};

type ImportContext = {
  membersByCode: Map<string, ImportMember[]>;
  current: Map<string, CurrentProfile>;
};

const PAGE_SIZE = 1000;
/** Mỗi đoàn viên tối đa MAX_CHILDREN con → 40 người/lượt vẫn dưới giới hạn 1000 dòng của PostgREST. */
const ID_CHUNK = 40;

async function loadImportContext(db: SupabaseClient, codes: string[]): Promise<ImportContext> {
  const wanted = new Set(codes.map(codeKey));
  const membersByCode = new Map<string, ImportMember[]>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from(CDILV_TABLE.profiles)
      .select("id, full_name, employee_code")
      .eq("approval_status", "approved")
      .not("employee_code", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const p of data ?? []) {
      const key = codeKey(String(p.employee_code));
      if (!wanted.has(key)) continue;
      const list = membersByCode.get(key) ?? [];
      list.push({ id: p.id, full_name: p.full_name, employee_code: p.employee_code });
      membersByCode.set(key, list);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  const ids = [...membersByCode.values()].flat().map((m) => m.id);
  const current = new Map<string, CurrentProfile>();
  for (const id of ids) current.set(id, { details: EMPTY_DETAILS, children: [], identity: null });

  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const [details, children, identities] = await Promise.all([
      db.from(CDILV_TABLE.memberDetails).select(`user_id, ${DETAIL_COLUMNS}`).in("user_id", chunk),
      db
        .from(CDILV_TABLE.memberChildren)
        .select("id, member_id, full_name, date_of_birth, gender, note")
        .in("member_id", chunk)
        .order("date_of_birth", { ascending: true }),
      db.from(CDILV_TABLE.memberIdentity).select("user_id, id_issue_date, id_issue_place").in("user_id", chunk),
    ]);
    if (details.error) throw details.error;
    if (children.error) throw children.error;
    if (identities.error) throw identities.error;

    for (const d of details.data ?? []) {
      const entry = current.get(d.user_id as string);
      if (entry) entry.details = normalizeDetails(d as unknown as MemberDetails);
    }
    for (const c of children.data ?? []) {
      current.get(c.member_id as string)?.children.push({
        id: c.id,
        full_name: c.full_name,
        date_of_birth: c.date_of_birth,
        gender: c.gender,
        note: c.note,
      });
    }
    for (const r of identities.data ?? []) {
      const entry = current.get(r.user_id as string);
      if (entry) entry.identity = { issue_date: r.id_issue_date ?? null, issue_place: r.id_issue_place ?? null };
    }
  }

  return { membersByCode, current };
}

// ---------------------------------------------------------------------------
// Đánh giá từng dòng (dùng chung cho xem trước và xác nhận)

type ImportEntry = { row: number; code: string | null; updates: Partial<MemberDetails>; errors: string[] };

type AssessedRow = ImportPreviewRow & { member: ImportMember | null; merged: MemberDetails | null };

function assessEntries(ctx: ImportContext, entries: ImportEntry[]): AssessedRow[] {
  const rowsByCode = new Map<string, number[]>();
  for (const e of entries) {
    if (!e.code) continue;
    const key = codeKey(e.code);
    rowsByCode.set(key, [...(rowsByCode.get(key) ?? []), e.row]);
  }

  return entries.map((e) => {
    const errors = [...e.errors];
    let member: ImportMember | null = null;

    if (!e.code) {
      errors.unshift("Thiếu Mã NV.");
    } else {
      const key = codeKey(e.code);
      const sameCode = rowsByCode.get(key) ?? [];
      const found = ctx.membersByCode.get(key) ?? [];
      if (sameCode.length > 1) errors.unshift(`Mã NV bị trùng trong file (dòng ${sameCode.join(", ")}).`);
      if (found.length === 0) {
        errors.unshift(`Không tìm thấy đoàn viên đã duyệt có Mã NV “${e.code}”.`);
      } else if (found.length > 1) {
        errors.unshift(`Mã NV “${e.code}” đang gắn với nhiều tài khoản, vui lòng kiểm tra lại.`);
      } else {
        member = found[0];
      }
    }

    let changes: ImportChange[] = [];
    let merged: MemberDetails | null = null;
    if (member) {
      const cur = ctx.current.get(member.id) ?? { details: EMPTY_DETAILS, children: [], identity: null };
      const next = normalizeDetails({ ...cur.details, ...e.updates });
      merged = next;
      changes = IMPORT_FIELDS.filter((f) => cur.details[f] !== next[f]).map((f) => ({
        field: f,
        label: DETAIL_FIELD_LABEL[f],
        old: formatImportValue(f, cur.details[f]),
        new: formatImportValue(f, next[f]),
      }));
      if (changes.length > 0) {
        errors.push(
          ...validateProfile(
            next,
            cur.children,
            { issue_date: cur.identity?.issue_date ?? null, issue_place: cur.identity?.issue_place ?? null },
            Boolean(cur.identity),
          ),
        );
      }
    }

    return {
      row: e.row,
      employee_code: e.code,
      member_name: member?.full_name ?? null,
      details: e.updates,
      changes,
      errors,
      member,
      merged,
    };
  });
}

function toPreviewRow({ member: _member, merged: _merged, ...row }: AssessedRow): ImportPreviewRow {
  return row;
}

// ---------------------------------------------------------------------------
// Xem trước

export async function previewMemberImport(
  db: SupabaseClient,
  buffer: ArrayBuffer,
): Promise<ImportPreviewResult | { error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: "Không đọc được file. Vui lòng dùng file Excel .xlsx (có thể tải file mẫu)." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "File không có trang tính nào." };

  const codeHeader = fold(IMPORT_CODE_HEADER);
  const fieldByHeader = new Map(IMPORT_FIELDS.map((f) => [fold(DETAIL_FIELD_LABEL[f]), f] as const));

  let headerRow = 0;
  let codeCol = 0;
  const fieldCols = new Map<number, keyof MemberDetails>();
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    ws.getRow(r).eachCell((cell, col) => {
      const text = plainCellValue(cell.value);
      if (typeof text === "string" && fold(text) === codeHeader) {
        headerRow = r;
        codeCol = col;
      }
    });
  }
  if (!headerRow) {
    return { error: `Không tìm thấy cột “${IMPORT_CODE_HEADER}” ở dòng tiêu đề. Vui lòng dùng file mẫu.` };
  }
  ws.getRow(headerRow).eachCell((cell, col) => {
    const text = plainCellValue(cell.value);
    if (typeof text !== "string") return;
    const field = fieldByHeader.get(fold(text));
    if (field && ![...fieldCols.values()].includes(field)) fieldCols.set(col, field);
  });
  if (fieldCols.size === 0) {
    return { error: "Không tìm thấy cột thông tin hồ sơ nào (tiêu đề phải trùng với file mẫu)." };
  }

  const entries: ImportEntry[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const codeRaw = plainCellValue(row.getCell(codeCol).value);
    const updates: Partial<MemberDetails> = {};
    const errors: string[] = [];
    let hasData = !isBlank(codeRaw);
    for (const [col, field] of fieldCols) {
      const raw = plainCellValue(row.getCell(col).value);
      const parsed = parseField(field, raw);
      if (parsed.kind === "empty") continue;
      hasData = true;
      if (parsed.kind === "error") errors.push(parsed.message);
      else (updates as Record<string, unknown>)[field] = parsed.value;
    }
    if (!hasData) continue;
    if (entries.length >= IMPORT_MAX_ROWS) {
      return { error: `File có hơn ${IMPORT_MAX_ROWS} dòng dữ liệu. Vui lòng chia nhỏ file.` };
    }
    const code = isBlank(codeRaw) ? null : String(codeRaw).trim();
    entries.push({ row: r, code, updates, errors });
  }
  if (entries.length === 0) return { error: "File không có dòng dữ liệu nào." };

  const ctx = await loadImportContext(
    db,
    entries.flatMap((e) => (e.code ? [e.code] : [])),
  );
  return {
    rows: assessEntries(ctx, entries).map(toPreviewRow),
    columns: [IMPORT_CODE_HEADER, ...[...fieldCols.values()].map((f) => DETAIL_FIELD_LABEL[f])],
  };
}

// ---------------------------------------------------------------------------
// Xác nhận

/** Đọc lại dữ liệu client gửi lên: chỉ nhận các trường MemberDetails, kiểm tra lại từng giá trị. */
export function parseCommitBody(body: unknown): ImportEntry[] | { error: string } {
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Không có dòng nào để cập nhật." };
  if (rows.length > IMPORT_MAX_ROWS) return { error: `Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập.` };

  return rows.map((item, index) => {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const rowNumber = Number.isInteger(r.row) && (r.row as number) > 0 ? (r.row as number) : index + 1;
    const codeRaw = r.employee_code;
    const code =
      (typeof codeRaw === "string" || typeof codeRaw === "number") && String(codeRaw).trim()
        ? String(codeRaw).trim()
        : null;
    const details = (r.details && typeof r.details === "object" ? r.details : {}) as Record<string, unknown>;
    const updates: Partial<MemberDetails> = {};
    const errors: string[] = [];
    for (const field of IMPORT_FIELDS) {
      if (!(field in details)) continue;
      const parsed = parseField(field, details[field]);
      if (parsed.kind === "error") errors.push(parsed.message);
      else if (parsed.kind === "ok") (updates as Record<string, unknown>)[field] = parsed.value;
    }
    return { row: rowNumber, code, updates, errors };
  });
}

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/** Lưu từng hồ sơ qua saveMemberProfile (giống sửa tay: ghi lịch sử, cộng điểm hoàn thiện hồ sơ). */
export async function commitMemberImport(
  db: SupabaseClient,
  actorId: string,
  entries: ImportEntry[],
): Promise<ImportCommitResult> {
  const ctx = await loadImportContext(
    db,
    entries.flatMap((e) => (e.code ? [e.code] : [])),
  );
  const result: ImportCommitResult = { updated: 0, skipped: 0, errors: [] };
  const toSave: AssessedRow[] = [];

  for (const row of assessEntries(ctx, entries)) {
    if (row.errors.length > 0) {
      result.skipped += 1;
      result.errors.push({ row: row.row, employee_code: row.employee_code ?? "", message: row.errors.join(" ") });
    } else if (!row.member || !row.merged || row.changes.length === 0) {
      result.skipped += 1;
    } else {
      toSave.push(row);
    }
  }

  await runPool(toSave, 4, async (row) => {
    const member = row.member!;
    const cur = ctx.current.get(member.id) ?? { details: EMPTY_DETAILS, children: [], identity: null };
    try {
      const saved = await saveMemberProfile(db, {
        targetId: member.id,
        actorId,
        payload: {
          userId: member.id,
          details: row.merged!,
          children: cur.children,
          identity: { issue_date: cur.identity?.issue_date ?? null, issue_place: cur.identity?.issue_place ?? null },
        },
        requireConsent: member.id === actorId,
      });
      if (saved.ok) {
        result.updated += 1;
      } else {
        result.skipped += 1;
        result.errors.push({ row: row.row, employee_code: member.employee_code, message: saved.errors.join(" ") });
      }
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: row.row,
        employee_code: member.employee_code,
        message: err instanceof Error ? err.message : "Không lưu được hồ sơ.",
      });
    }
  });

  result.errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return result;
}

// ---------------------------------------------------------------------------
// File mẫu

const ENUM_HINT: Partial<Record<keyof MemberDetails, string[]>> = {
  gender: Object.values(GENDER_LABEL),
  marital_status: Object.values(MARITAL_STATUS_LABEL),
  no_children: ["Có", "Không"],
};

export async function buildImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hồ sơ đoàn viên", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [IMPORT_CODE_HEADER, ...IMPORT_FIELDS.map((f) => DETAIL_FIELD_LABEL[f])];
  ws.columns = headers.map((_, i) => ({
    width: i === 0 ? 14 : ["permanent_address", "current_address"].includes(IMPORT_FIELDS[i - 1]) ? 40 : 22,
    style: { numFmt: "@" },
  }));

  const headerRow = ws.getRow(1);
  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF4FF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin" } };
  });
  headerRow.height = 30;

  IMPORT_FIELDS.forEach((field, i) => {
    const options = ENUM_HINT[field];
    if (!options) return;
    for (let r = 2; r <= IMPORT_MAX_ROWS + 1; r++) {
      ws.getCell(r, i + 2).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${options.join(",")}"`],
        showErrorMessage: true,
        errorTitle: DETAIL_FIELD_LABEL[field],
        error: `Chọn một trong: ${options.join(", ")}`,
      };
    }
  });

  const guide = wb.addWorksheet("Hướng dẫn");
  guide.columns = [{ width: 28 }, { width: 90 }];
  const lines: [string, string][] = [
    ["Cách dùng", "Mỗi dòng là một đoàn viên, tìm theo Mã NV (đoàn viên đã được duyệt). Mỗi Mã NV chỉ xuất hiện 1 lần."],
    ["Ô để trống", "Giữ nguyên giá trị đang lưu (không xóa)."],
    [DETAIL_FIELD_LABEL.date_of_birth, "Nhập dạng dd/mm/yyyy, ví dụ 02/05/1990."],
    [DETAIL_FIELD_LABEL.gender, Object.values(GENDER_LABEL).join(" hoặc ")],
    [DETAIL_FIELD_LABEL.marital_status, Object.values(MARITAL_STATUS_LABEL).join(" hoặc ")],
    [DETAIL_FIELD_LABEL.no_children, "Có hoặc Không"],
    [DETAIL_FIELD_LABEL.phone, "10 chữ số, bắt đầu bằng 0."],
    [DETAIL_FIELD_LABEL.bank_account_no, "Chỉ gồm chữ số (6–20 số); cần kèm tên ngân hàng."],
    ["Không nhập được", "Số CCCD, thông tin con, vai trò, điểm, tài khoản — các cột khác ngoài mẫu sẽ bị bỏ qua."],
    ["Giới hạn", `Tối đa ${IMPORT_MAX_ROWS} dòng, file .xlsx không quá 2 MB. Hệ thống cho xem trước trước khi cập nhật.`],
  ];
  lines.forEach(([a, b], i) => {
    const row = guide.getRow(i + 1);
    row.getCell(1).value = a;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = b;
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
